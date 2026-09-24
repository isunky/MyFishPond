import type { FishEntity } from '../fish/FishEntity';

export class SpatialGrid {
  private cells = new Map<string, FishEntity[]>();

  constructor(private readonly cellSize: number) {}

  rebuild(fish: FishEntity[]) {
    this.cells.clear();
    for (const entity of fish) {
      const key = this.key(entity.x, entity.y);
      const cell = this.cells.get(key);
      if (cell) cell.push(entity);
      else this.cells.set(key, [entity]);
    }
  }

  query(x: number, y: number) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    const result: FishEntity[] = [];
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        result.push(...(this.cells.get(`${cellX + offsetX},${cellY + offsetY}`) ?? []));
      }
    }
    return result;
  }

  private key(x: number, y: number) {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }
}
