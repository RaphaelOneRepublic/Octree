"use strict";
const THREE = require("three");
const TrackballControls = require("three-orbitcontrols");

const MATERIALS = {
    // Material for drawing containing boxes
    BORDER: new THREE.MeshBasicMaterial({color: 0xfefefe, wireframe: true, opacity: 0.5}),
    // Material for drawing dots
    CUBE: new THREE.MeshNormalMaterial()
};

const CUBE_HALF_DIMENSION = 400;
const NUM_DOTS = 20;

window.addEventListener("load", function () {
    this.app = new App();
    app.init();
    app.animate();
    console.log(app);
});
window.addEventListener("resize", function () {
    this.app.resize();
});


const App = function () {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
};

App.prototype.init = function () {
    const geometry = new THREE.SphereBufferGeometry(2);

    this.octree = new Octree(new THREE.Vector3(0, 0, 0), new THREE.Vector3(
        CUBE_HALF_DIMENSION, CUBE_HALF_DIMENSION, CUBE_HALF_DIMENSION
    ));

    for (let i = 0; i < NUM_DOTS; i++) {
        const dot = new THREE.Mesh(geometry, MATERIALS.CUBE);
        dot.position.set(
            Math.random() * CUBE_HALF_DIMENSION * 2 - CUBE_HALF_DIMENSION,
            Math.random() * CUBE_HALF_DIMENSION * 2 - CUBE_HALF_DIMENSION,
            Math.random() * CUBE_HALF_DIMENSION * 2 - CUBE_HALF_DIMENSION
        );
        this.scene.add(dot);
        this.octree.insert(dot.position);
    }

    this.octree.draw(this.scene);

    const controls = new TrackballControls(this.camera, this.renderer.domElement);
    console.log(controls);
    this.camera.position.z = 500;
};

App.prototype.animate = function () {
    requestAnimationFrame(function (self) {
        return function () {
            self.animate();
        }
    }(this));
    this.renderer.render(this.scene, this.camera);
};


App.prototype.resize = function () {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
};

/**
 * Constructor of Octree
 * */
const Octree = function (origin, dimension) {
    // Physical position/size. This implicitly defines the bounding
    // box of this node

    //! The physical center of this node
    this.origin = origin;

    //! Half the width/height/depth of this node
    this.dimension = dimension;

    //! Pointers to child octants, initialized to contain nothing
    this.children = [];

    //! Data stored in this node. In this case only the position
    this.data = null;
};

// Determine which octant of the tree would contain 'point'
Octree.prototype.getOctantContainingPoint = function (point) {
    /**
     Children follow a predictable pattern to make accesses simple.
     Here, - means less than 'origin' in that dimension, + means greater than.
     child:    0 1 2 3 4 5 6 7
     x:      - - - - + + + +
     y:      - - + + - - + +
     z:      - + - + - + - +
     */
    let oct = 0;
    if (point.x >= this.origin.x) oct |= 4; // High bit
    if (point.y >= this.origin.y) oct |= 2; // Mid bit
    if (point.z >= this.origin.z) oct |= 1; // Low bit
    return oct;
};

Octree.prototype.isLeafNode = function () {
    // We are a leaf iff we have no children. Since we either have none, or
    // all eight, it is sufficient to just check the first.
    return this.children.length === 0;
};

Octree.prototype.insert = function (point) {
    // If this node doesn't have a data point yet assigned
    // and it is a leaf, then we're done!
    if (this.isLeafNode()) {
        if (this.data == null) {
            this.data = point;
        } else {
            // We're at a leaf, but there's already something here
            // We will split this node so that it has 8 child octants
            // and then insert the old data that was here, along with
            // this new data point

            // Save this data point that was here for a later re-insert
            const temp = this.data;
            this.data = null;
            // Split the current node and create new empty trees for each
            // child octant.
            for (let i = 0; i < 8; ++i) {
                let newOrigin = new THREE.Vector3(
                    this.origin.x + this.dimension.x * (i & 4 ? .5 : -.5),
                    this.origin.y + this.dimension.y * (i & 2 ? .5 : -.5),
                    this.origin.z + this.dimension.z * (i & 1 ? .5 : -.5),
                );
                let newDimension = new THREE.Vector3(
                    this.dimension.x / 2,
                    this.dimension.y / 2,
                    this.dimension.z / 2,
                );
                this.children[i] = new Octree(newOrigin, newDimension);
            }
            // Re-insert the old point, and insert this new point
            // (We wouldn't need to insert from the root, because we already
            // know it's guaranteed to be in this section of the tree)
            this.children[this.getOctantContainingPoint(temp)].insert(temp);
            this.children[this.getOctantContainingPoint(point)].insert(point);
        }
    } else {
        // We are at an interior node. Insert recursively into the
        // appropriate child octant
        const octant = this.getOctantContainingPoint(point);
        this.children[octant].insert(point);
    }
};

// This is a really simple routine for querying the tree for points
// within a bounding box defined by min/max points (bmin, bmax)
// All results are pushed into 'results'
Octree.prototype.getPointsInsideBox = function (bmin, bmax, results) {
    // If we're at a leaf node, just see if the current data point is inside
    // the query bounding box
    if (this.isLeafNode()) {
        if (this.data != null) {
            const p = this.data;
            if (p.x > bmax.x || p.y > bmax.y || p.z > bmax.z) return;
            if (p.x < bmin.x || p.y < bmin.y || p.z < bmin.z) return;
            results.append(this.data);
        }
    } else {
        // We're at an interior node of the tree. We will check to see if
        // the query bounding box lies outside the octants of this node.
        for (let i = 0; i < 8; ++i) {
            // Compute the min/max corners of this child octant
            const cmax = children[i].origin + children[i].dimension;
            const cmin = children[i].origin - children[i].dimension;
            // If the query rectangle is outside the child's bounding box,
            // then continue
            if (cmax.x < bmin.x || cmax.y < bmin.y || cmax.z < bmin.z) continue;
            if (cmin.x > bmax.x || cmin.y > bmax.y || cmin.z > bmax.z) continue;
            // At this point, we've determined that this child is intersecting
            // the query bounding box
            children[i].getPointsInsideBox(bmin, bmax, results);
        }
    }
};

/** Add a cube corresponding to the octree node to the given scene,
 * If there are children, add them too.
 */
Octree.prototype.draw = function (scene) {

    const cube = new THREE.Mesh(
        new THREE.BoxBufferGeometry(this.dimension.x * 2, this.dimension.y * 2, this.dimension.z * 2),
        MATERIALS.BORDER
    );
    cube.position.set(this.origin.x, this.origin.y, this.origin.z);
    scene.add(cube);
    if (this.children.length === 0) return;
    for (let i = 0; i < 8; i++) {
        this.children[i].draw(scene);
    }
};