export interface Component {
  render(width: number): string[];
}

export class Container implements Component {
  private children: Component[] = [];
  private readonly gap: number;

  constructor(options: { gap?: number } = {}) {
    this.gap = options.gap ?? 0;
  }

  addChild(child: Component): void {
    this.children.push(child);
  }

  setChildren(children: Component[]): void {
    this.children = [...children];
  }

  clear(): void {
    this.children = [];
  }

  render(width: number): string[] {
    const lines: string[] = [];
    this.children.forEach((child, index) => {
      lines.push(...child.render(width));
      if (index < this.children.length - 1) {
        for (let i = 0; i < this.gap; i += 1) {
          lines.push("");
        }
      }
    });
    return lines.length > 0 ? lines : ["".padEnd(width, " ")];
  }
}
