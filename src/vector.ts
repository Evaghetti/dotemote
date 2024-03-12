export class Vector {
  constructor(
    public x: number,
    public y: number,
  ) {}

  // Original methods returning new instances

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

  // New methods modifying the instance itself

  // In-place addition
  inplaceAdd(other: Vector): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  // In-place subtraction
  inplaceSubtract(other: Vector): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  // In-place multiplication by scalar
  inplaceMultiplyScalar(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  // In-place division by scalar
  inplaceDivideScalar(scalar: number): this {
    if (scalar === 0) {
      throw new Error("Division by zero");
    }
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }
}

export interface Transform {
  position: Vector;
  size: Vector;
}
