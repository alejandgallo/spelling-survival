// 3D Game Engine using Three.js
const GameEngine = {
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    canvas: null,
    
    players: {}, // Store avatar instances by socket id
    localPlayerId: null,
    
    lavaMesh: null,
    ladderGroup: null,
    environmentGroup: null,
    
    keys: {},
    targetCameraPos: new THREE.Vector3(0, 5, 10),
    targetCameraLook: new THREE.Vector3(0, 0, 0),

    init: function() {
        this.canvas = document.getElementById('canvas-container');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 150);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.canvas.appendChild(this.renderer.domElement);

        // Clock for animations
        this.clock = new THREE.Clock();

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 30, 20);
        dirLight.castShadow = true;
        
        // Configure shadow camera bounds
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        
        this.scene.add(dirLight);

        // Environment Groups
        this.environmentGroup = new THREE.Group();
        this.ladderGroup = new THREE.Group();
        this.scene.add(this.environmentGroup);
        this.scene.add(this.ladderGroup);

        // Listeners
        window.addEventListener('resize', () => this.onResize(), false);
        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);

        // Start render loop
        this.animate();
    },

    onResize: function() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    // --- ENVIRONMENT BUILDING ---

    buildWaitingRoom: function() {
        // Clear previous environments
        this.clearGroup(this.environmentGroup);
        this.clearGroup(this.ladderGroup);
        if (this.lavaMesh) {
            this.scene.remove(this.lavaMesh);
            this.lavaMesh = null;
        }

        // Floor
        const floorGeo = new THREE.BoxGeometry(40, 1, 40);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 }); // Green grass
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.y = -0.5;
        floor.receiveShadow = true;
        this.environmentGroup.add(floor);

        // Decorative blocks (Roblox style)
        const colors = [0xff4757, 0xffa502, 0x2ed573, 0x1e90ff, 0xa55eea];
        for (let i = 0; i < 10; i++) {
            const size = Math.random() * 2 + 1;
            const blockGeo = new THREE.BoxGeometry(size, size, size);
            const blockMat = new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)] });
            const block = new THREE.Mesh(blockGeo, blockMat);
            block.position.set(
                (Math.random() - 0.5) * 30,
                size / 2,
                (Math.random() - 0.5) * 30
            );
            block.castShadow = true;
            block.receiveShadow = true;
            this.environmentGroup.add(block);
        }
        
        // Set camera for top-down ish view
        this.targetCameraPos.set(0, 15, 20);
        this.targetCameraLook.set(0, 0, 0);
    },

    buildGameArena: function() {
        this.clearGroup(this.environmentGroup);
        this.clearGroup(this.ladderGroup);

        // Lava pit base
        const pitGeo = new THREE.BoxGeometry(30, 2, 30);
        const pitMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.y = -1;
        this.environmentGroup.add(pit);

        // The Ladder (Very tall)
        const ladderHeight = 100; // Enough steps for the game
        const stepDepth = 1;
        const stepWidth = 8; // Wide enough for multiple players
        
        // Ladder frame
        const frameMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const leftFrameGeo = new THREE.BoxGeometry(1, ladderHeight, 1);
        const leftFrame = new THREE.Mesh(leftFrameGeo, frameMat);
        leftFrame.position.set(-stepWidth/2 - 0.5, ladderHeight/2, 0);
        leftFrame.castShadow = true;
        this.ladderGroup.add(leftFrame);

        const rightFrame = leftFrame.clone();
        rightFrame.position.x = stepWidth/2 + 0.5;
        this.ladderGroup.add(rightFrame);

        // Ladder Steps (visual only, players stand on them based on step count)
        for (let i = 0; i < 40; i++) { // Visual steps
            const stepGeo = new THREE.BoxGeometry(stepWidth, 0.2, stepDepth);
            const stepMat = new THREE.MeshLambertMaterial({ color: 0xD2691E });
            const step = new THREE.Mesh(stepGeo, stepMat);
            step.position.set(0, i + 0.5, 0); // Each step is 1 unit high
            step.receiveShadow = true;
            step.castShadow = true;
            this.ladderGroup.add(step);
        }

        // Lava Mesh
        const lavaGeo = new THREE.BoxGeometry(29, 1, 29);
        const lavaMat = new THREE.MeshLambertMaterial({ color: 0xff3300, emissive: 0xff0000, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 });
        this.lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
        this.lavaMesh.position.y = 0; // Starts at ground level
        this.scene.add(this.lavaMesh);
        
        // Camera setup for game
        this.targetCameraPos.set(0, 5, 15);
        this.targetCameraLook.set(0, 5, 0);
    },

    setLavaHeight: function(height) {
        if (this.lavaMesh) {
            this.lavaMesh.position.y = height;
        }
    },

    // --- PLAYER MANAGEMENT ---

    setLocalPlayer: function(id) {
        this.localPlayerId = id;
    },

    addPlayer: function(id, playerData) {
        if (this.players[id]) return; // Already exists

        const colors = {
            head: parseInt(playerData.color.head.replace('#', '0x')),
            body: parseInt(playerData.color.body.replace('#', '0x')),
            legs: parseInt(playerData.color.legs.replace('#', '0x'))
        };

        const avatar = new Avatar(this.scene, playerData.name, colors);
        avatar.group.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
        
        this.players[id] = avatar;
        this.scene.add(avatar.group);
    },

    removePlayer: function(id) {
        if (this.players[id]) {
            this.scene.remove(this.players[id].group);
            delete this.players[id];
        }
    },

    updatePlayers: function(playersData) {
        // Add new players
        Object.keys(playersData).forEach(id => {
            if (!this.players[id]) {
                this.addPlayer(id, playersData[id]);
            }
        });
        // Remove disconnected players
        Object.keys(this.players).forEach(id => {
            if (!playersData[id]) {
                this.removePlayer(id);
            }
        });
    },

    movePlayer: function(id, pos) {
        if (this.players[id]) {
            // Smooth movement could be added here, but for simplicity, direct update
            this.players[id].group.position.x = pos.x;
            this.players[id].group.position.z = pos.z;
        }
    },

    climbPlayer: function(id, step) {
        if (this.players[id]) {
            // Move player up to the specific step
            this.players[id].group.position.y = step + 0.5;
            // Add a little hop animation by adjusting rotation slightly
            this.players[id].group.rotation.y += 0.2; 
        }
    },

    eliminatePlayer: function(id) {
        if (this.players[id]) {
            // Make the player fall or turn grey
            this.players[id].group.position.y = -2; // Drop into lava
        }
    },

    // --- INPUT & LOCAL PLAYER LOGIC ---

    handleLocalMovement: function() {
        if (!this.localPlayerId || !this.players[this.localPlayerId]) return;
        
        const player = this.players[this.localPlayerId];
        const speed = 0.2;
        let moved = false;

        let currentX = player.group.position.x;
        let currentZ = player.group.position.z;

        if (this.keys['w'] || this.keys['arrowup']) {
            currentZ -= speed;
            moved = true;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            currentZ += speed;
            moved = true;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            currentX -= speed;
            moved = true;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            currentX += speed;
            moved = true;
        }

        // Simple boundary checks for waiting room
        if (moved) {
            // Clamp to environment bounds (40x40 room)
            currentX = Math.max(-19, Math.min(19, currentX));
            currentZ = Math.max(-19, Math.min(19, currentZ));
            
            player.group.position.x = currentX;
            player.group.position.z = currentZ;
            
            // Return data to be sent to server
            return { x: currentX, y: 0, z: currentZ };
        }
        return null;
    },

    // --- ANIMATION LOOP ---

    clearGroup: function(group) {
        while(group.children.length > 0){ 
            group.remove(group.children[0]); 
        }
    },

    animate: function() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        // Handle local movement
        const moveData = this.handleLocalMovement();
        if (moveData) {
            // Emit movement to server (handled in main.js)
            if (window.GameNetwork && typeof window.GameNetwork.sendMovement === 'function') {
                window.GameNetwork.sendMovement(moveData);
            }
        }

        // Update avatars (e.g., floating animations)
        Object.keys(this.players).forEach(id => {
            this.players[id].update(delta);
        });

        // Camera Lerp (Smooth follow)
        if (this.localPlayerId && this.players[this.localPlayerId]) {
            const target = this.players[this.localPlayerId].group.position;
            // Adjust camera based on player height (for ladder climbing)
            const desiredY = target.y + 5;
            const desiredZ = target.z + 15; // Keep camera behind
            
            this.camera.position.x += (target.x - this.camera.position.x) * 0.05;
            this.camera.position.y += (desiredY - this.camera.position.y) * 0.05;
            this.camera.position.z += (desiredZ - this.camera.position.z) * 0.05;
            
            this.camera.lookAt(target.x, target.y, target.z);
        } else {
            // Default lobby camera
            this.camera.position.x += (this.targetCameraPos.x - this.camera.position.x) * 0.05;
            this.camera.position.y += (this.targetCameraPos.y - this.camera.position.y) * 0.05;
            this.camera.position.z += (this.targetCameraPos.z - this.camera.position.z) * 0.05;
            this.camera.lookAt(this.targetCameraLook);
        }

        // Animate lava (wave effect)
        if (this.lavaMesh) {
            this.lavaMesh.scale.y = 1 + Math.sin(this.clock.elapsedTime * 2) * 0.1;
        }

        this.renderer.render(this.scene, this.camera);
    }
};