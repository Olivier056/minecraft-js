THREE.PointerLockControls = function ( object, domElement ) {

	var scope = this;

	this.domElement = domElement || document.body;

	this.isLocked = false;

	this.minPolarAngle = 0;

	this.maxPolarAngle = Math.PI;

	this.pointerSpeed = 1.0;

	var changeEvent = { type: 'change' };

	var lockEvent = { type: 'lock' };

	var unlockEvent = { type: 'unlock' };

	var euler = new THREE.Euler( 0, 0, 0, 'YXZ' );

	var PI_2 = Math.PI / 2;

	var vec = new THREE.Vector3();

	function onMouseMove( event ) {

		if ( scope.isLocked === false ) return;

		var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;

		var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

		euler.setFromQuaternion( object.quaternion );

		euler.y -= movementX * 0.002 * scope.pointerSpeed;

		euler.x -= movementY * 0.002 * scope.pointerSpeed;

		euler.x = Math.max( PI_2 - scope.maxPolarAngle, Math.min( PI_2 - scope.minPolarAngle, euler.x ) );

		object.quaternion.setFromEuler( euler );

		scope.dispatchEvent( changeEvent );

	}

	function onPointerLockChange() {

		if ( document.pointerLockElement === scope.domElement ) {

			scope.dispatchEvent( lockEvent );

			scope.isLocked = true;

		} else {

			scope.dispatchEvent( unlockEvent );

			scope.isLocked = false;

		}

	}

	function onPointerLockError() {

		console.error( 'THREE.PointerLockControls: Unable to use Pointer Lock API' );

	}

	this.connect = function () {

		document.addEventListener( 'mousemove', onMouseMove, false );

		document.addEventListener( 'pointerlockchange', onPointerLockChange, false );

		document.addEventListener( 'pointerlockerror', onPointerLockError, false );

	};

	this.disconnect = function () {

		document.removeEventListener( 'mousemove', onMouseMove, false );

		document.removeEventListener( 'pointerlockchange', onPointerLockChange, false );

		document.removeEventListener( 'pointerlockerror', onPointerLockError, false );

	};

	this.dispose = function () {

		this.disconnect();

	};

	this.getObject = function () {

		return object;

	};

	this.getDirection = function () {

		var direction = new THREE.Vector3( 0, 0, - 1 );

		return function ( v ) {

			return v.copy( direction ).applyQuaternion( object.quaternion );

		};

	}();

	this.moveForward = function ( distance ) {

		vec.setFromMatrixColumn( object.matrix, 0 );

		vec.crossVectors( object.up, vec );

		object.position.addScaledVector( vec, distance );

	};

	this.moveRight = function ( distance ) {

		vec.setFromMatrixColumn( object.matrix, 0 );

		object.position.addScaledVector( vec, distance );

	};

	this.lock = function () {

		this.domElement.requestPointerLock();

	};

	this.unlock = function () {

		document.exitPointerLock();

	};

	this.connect();

};

THREE.PointerLockControls.prototype = Object.create( THREE.EventDispatcher.prototype );

THREE.PointerLockControls.prototype.constructor = THREE.PointerLockControls;