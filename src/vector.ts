
class Vector {
    constructor(public x: number, public y: number) { }

    // Addition
    add(other: Vector): Vector {
        return new Vector(this.x + other.x, this.y + other.y);
    }

    // Subtraction
    subtract(other: Vector): Vector {
        return new Vector(this.x - other.x, this.y - other.y);
    }

    // Multiplication by scalar
    multiplyScalar(scalar: number): Vector {
        return new Vector(this.x * scalar, this.y * scalar);
    }

    // Division by scalar
    divideScalar(scalar: number): Vector {
        if (scalar === 0) {
            throw new Error("Division by zero");
        }
        return new Vector(this.x / scalar, this.y / scalar);
    }
}

interface Transform {
    position: Vector,
    size: Vector
}

