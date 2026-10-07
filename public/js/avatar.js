// A Roblox-style blocky avatar generator using Three.js
class Avatar {
    constructor(scene, name = "Player", colors = { head: 0xffcc00, body: 0x0099ff, legs: 0x0055ff }) {
        this.scene = scene;
        this.name = name;
        this.colors = colors;
        this.group = new THREE.Group();
        this.isFloating = false;
        this.floatTime = 0;

        this.build();
        this.createNameTag();
    }

    build() {
        // Materials
        const headMat = new THREE.MeshLambertMaterial({ color: this.colors.head });
        const bodyMat = new THREE.MeshLambertMaterial({ color: this.colors.body });
        const legsMat = new THREE.MeshLambertMaterial({ color: this.colors.legs });
        const armMat = new THREE.MeshLambertMaterial({ color: this.colors.head }); // Arms match head for simplicity

        // Dimensions (Roblox-like proportions)
        const w = 1.2, d = 0.6, h = 1.5; // width, depth, height

        // Head
        this.head = new THREE.Mesh(new THREE.BoxGeometry(w, w, w), headMat);
        this.head.position.y = h + (w/2);
        this.head.castShadow = true;

        // Torso
        this.torso = new THREE.Mesh(new THREE.BoxGeometry(w*1.2, h, d*1.2), bodyMat);
        this.torso.position.y = h/2;
        this.torso.castShadow = true;

        // Left Arm
        this.armL = new THREE.Mesh(new THREE.BoxGeometry(d, h, d), armMat);
        this.armL.position.set(-(w*1.2)/2 - d/2, h/2, 0);
        this.armL.castShadow = true;

        // Right Arm
        this.armR = new THREE.Mesh(new THREE.BoxGeometry(d, h, d), armMat);
        this.armR.position.set((w*1.2)/2 + d/2, h/2, 0);
        this.armR.castShadow = true;

        // Left Leg
        this.legL = new THREE.Mesh(new THREE.BoxGeometry(w/2, h, d), legsMat);
        this.legL.position.set(-w/4, -h/2, 0);
        this.legL.castShadow = true;

        // Right Leg
        this.legR = new THREE.Mesh(new THREE.BoxGeometry(w/2, h, d), legsMat);
        this.legR.position.set(w/4, -h/2, 0);
        this.legR.castShadow = true;

        // Group positioning
        this.group.add(this.head);
        this.group.add(this.torso);
        this.group.add(this.armL);
        this.group.add(this.armR);
        this.group.add(this.legL);
        this.group.add(this.legR);

        // Offset group so feet are at y=0
        this.group.position.y = h/2 + 0.1;
    }

    createNameTag() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.fillStyle = 'rgba(0,0,0,0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 40px Fredoka One, Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(this.name, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        this.sprite = new THREE.Sprite(material);
        this.sprite.scale.set(2, 0.5, 1);
        this.sprite.position.y = 3.5; // Float above head
        this.group.add(this.sprite);
    }

    startFloating() {
        this.isFloating = true;
    }

    stopFloating() {
        this.isFloating = false;
    }

    // Call this in the render loop
    update(delta) {
        if (this.isFloating) {
            this.floatTime += delta;
            this.group.position.y = 1.5 + Math.sin(this.floatTime * 2) * 0.3;
            this.group.rotation.y = Math.sin(this.floatTime) * 0.5;
        }
    }
}
