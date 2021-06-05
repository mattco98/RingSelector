/**
 * option keys:
 *   items:        The items that will be displayed. This must be an 
 *                   array. The array can contain either strings or objects.
 *                   See below for the item object structure.
 *   center:       An array containing the x and y center for this menu.
 *                   Defaults to [Renderer.screen.getWidth() / 2, 
 *                   Renderer.screen.getHeight() / 2]. The array can also 
 *                   contain functions for dynamic centering.
 *   innerRadius:  A number or function defining the inner circle's radius. 
 *                   Defaults to Renderer.screen.getHeight() / 8.
 *   outerRadius:  A number or function defining the outer circle's radius. 
 *                   Defaults to Renderer.screen.getHeight() / 2.7.
 *   rotOffset:    A rotational offset, in radians. Defaults to 0.
 *   clockwise:    If true, draws the strings clockwise.
 *   bgColor:      Option background color. Defaults to
 *                   Renderer.color(50, 50, 50, 150).
 *   fgColor:      Option foreground color (the color drawn when an option
 *                   is hovered). Defaults to 
 *                   Renderer.color(150, 150, 150, 255).
 *   lineSepColor: Option seperator color. Defaults to 
 *                   Renderer.color(50, 50, 50, 125). Drawn over option
 *                   backgrounds.
 *   callback:     Callback function if an option is pressed. Passed the
 *                   clicked item as the first argument, and the selector
 *                   as the second argument.
 * 
 * Providing an item as an object rather than a string allows more 
 * fine-grained control over the display of that particular item. No matter
 * the type of the item, that exact item will be returned to the callback
 * function if it is clicked. This means that you can supply arbitrary
 * data in the item object, and receive that data in the callback.
 * 
 * If the item is given as an object, you can also include the following
 * keys:
 *   width:        Specify a custom width, in radians. Must be less 
 *                   than 2 * PI.
 *   key:          A Keyboard key. If provided, when this key is pressed,
 *                   it's item will be selected. An alternative to using
 *                   the mouse to click the option.
 *   text:         Contains the name to display. Can be a string or a Text
 *                   object.
 *   innerRadius:  See above.
 *   outerRadius:  See above.
 *   bgColor:      See above.
 *   fgColor:      See above.
 *   callback:     Takes precedence over the general callback provided
 *                 to the RingSelector. If an item callback is supplied,
 *                 the general callback will NOT be called for that item.
 */

const TWO_PI = 2 * Math.PI;

class RingSelector {
  hoveredOption = undefined;
  opened = false;
  gui = new Gui();

  get xCenter() {
    return Reflect.isCallable(this._xCenter) ? this._xCenter() : this._xCenter;
  }

  get yCenter() {
    return Reflect.isCallable(this._yCenter) ? this._yCenter() : this._yCenter;
  }

  constructor(options) {
    this.items = options.items;
    this.rotOffset = options.rotOffset ?? 0;
    this.callback = options.callback ?? (() => {});
    this.lineSepColor = options.lineSepColor ?? Renderer.color(50, 50, 50, 125);

    this._xCenter = options.center?.[0] ?? Renderer.screen.getWidth() / 2;
    this._yCenter = options.center?.[1] ?? Renderer.screen.getHeight() / 2;

    this.mappedItems = this.items?.map(item => {
      if (!(typeof item === 'string' || typeof item === 'object'))
        throw new Error('[RingSelector] items config must contain only strings or objects');

      let name = item.name ?? item;
      if (!(name instanceof Text) && typeof name === 'string') 
        name = new Text(name, 0, 0);
      else if (typeof name !== 'string' && !(name instanceof Text))
        throw new Error('[RingSelector] item name must be a string or an instanceof Text');

      return {
        name,
        innerRadius: () => {
          const rad = item.innerRadius ?? options.innerRadius ?? Renderer.screen.getHeight() / 8;
          return Reflect.isCallable(rad) ? rad() : rad;
        },
        outerRadius: () => {
          const rad = item.outerRadius ?? options.outerRadius ?? Renderer.screen.getHeight() / 2.7;
          return Reflect.isCallable(rad) ? rad() : rad;
        },
        bgColor: item.bgColor ?? options.bgColor ?? Renderer.color(50, 50, 50, 150),
        fgColor: item.fgColor ?? options.fgColor ?? Renderer.color(175, 175, 175, 200),
        color: item.bgColor   ?? options.bgColor ?? Renderer.color(50, 50, 50, 150),
        width: item.width,
        key: item.key,
        callback: item.callback
      };
    });

    // Handle item 'width' key
    let totalWidth = TWO_PI;
    let itemsLeft = this.mappedItems.length;

    this.mappedItems.forEach(item => {
      const width = item.width;
      if (!width) return;

      if (width > TWO_PI) 
        throw new Error("[RingSelector] item 'width' key must be less than 2*PI");

      totalWidth -= width;
      itemsLeft--;

      if (totalWidth >= TWO_PI && itemsLeft > 0) 
        throw new Error('[RingSelector] radius required to display all items exceeds 2*PI');
    });

    let prev = 0;

    this.mappedItems.forEach((item, i) => {
      const width = item.width ?? (totalWidth / itemsLeft);

      this.mappedItems[i].startAngle = prev;
      this.mappedItems[i].endAngle = prev + width;
      prev += width;
    });

    // Reverse if clockwise
    if (options.clockwise) {
      this.items = this.items.reverse();
      this.mappedItems = this.mappedItems.reverse();
    }
    
    this.gui.registerDraw(this.draw.bind(this));
    this.gui.registerClicked(this.clicked.bind(this));
    this.gui.registerKeyTyped(this.keyTyped.bind(this));
    register('step', this.updateOptionColors.bind(this)).setFps(144);
  }

  open() {
    this.gui.open();
  }

  close() {
    this.gui.close();
  }

  normalizeAngle(theta) {
    while (theta < 0)
      theta += TWO_PI;

    while (theta >= TWO_PI)
      theta -= TWO_PI;

    return theta;
  }

  isOptionHovered(x, y, item) {
    x -= this.xCenter;
    y -= this.yCenter;

    const hypot = Math.sqrt(x ** 2 + y ** 2);
    const mAngle = this.normalizeAngle(Math.atan2(y, x) + this.rotOffset);

    return mAngle >= item.startAngle && mAngle < item.endAngle && 
      hypot >= item.innerRadius() && hypot <= item.outerRadius();
  }

  updateOptionColors() {
    if (!this.opened && !this.gui.isOpen()) return;

    this.mappedItems.forEach((item, i) => {
      this.mappedItems[i].color = easeColor(
        item.color,
        i === this.hoveredOption ? item.fgColor : item.bgColor,
        10,
        1
      );
    });
  }

  drawAnnularSector(options) {
    const item = options.item;
    const endAngle = options.startAngle;
    const startAngle = options.endAngle;
    const innerRadius = item.innerRadius();
    const outerRadius = item.outerRadius();

    const steps = 50;
    const color = item.color ?? Renderer.color(255, 255, 255, 255);
    const xCenter = this.xCenter;
    const yCenter = this.yCenter;
    const theta = -(endAngle - startAngle) / steps;

    for (let i = 0; i < steps; i++) {
      new Shape(color)
        .setDrawMode(7)
        .addVertex(xCenter + outerRadius * Math.cos(startAngle - theta * i), yCenter + outerRadius * Math.sin(startAngle - theta * i))
        .addVertex(xCenter + outerRadius * Math.cos(startAngle - theta * (i + 1)), yCenter + outerRadius * Math.sin(startAngle - theta * (i + 1)))
        .addVertex(xCenter + innerRadius * Math.cos(startAngle - theta * (i + 1)), yCenter + innerRadius * Math.sin(startAngle - theta * (i + 1)))
        .addVertex(xCenter + innerRadius * Math.cos(startAngle - theta * i), yCenter + innerRadius * Math.sin(startAngle - theta * i))
        .draw();
    }
  }

  draw(mouseX, mouseY) {
    let hovered = false;

    this.mappedItems.forEach((item, i) => {
      if (this.isOptionHovered(mouseX, mouseY, item)) {
        this.hoveredOption = i;
        hovered = true;
      }
    });

    if (!hovered) this.hoveredOption = undefined;

    this.mappedItems.forEach(item => {
      const startAngle = item.startAngle - this.rotOffset;
      const endAngle = item.endAngle - this.rotOffset;
      const midAngle = ((endAngle - startAngle) / 2) + startAngle;
      const innerRadius = item.innerRadius();
      const outerRadius = item.outerRadius();

      const center = {
        x: this.xCenter + Math.cos(midAngle) * (innerRadius + outerRadius) / 2,
        y: this.yCenter + Math.sin(midAngle) * (innerRadius + outerRadius) / 2
      };

      this.drawAnnularSector({ startAngle, endAngle, item });
      
      item.name
        .setAlign('CENTER')
        .setX(center.x)
        .setY(center.y - 4.5)
        .draw();

      var boundary1 = {
        x: this.xCenter + innerRadius * Math.cos(startAngle),
        y: this.yCenter + innerRadius * Math.sin(startAngle)
      };
      
      var boundary2 = {
        x: this.xCenter + outerRadius * Math.cos(startAngle),
        y: this.yCenter + outerRadius * Math.sin(startAngle)
      };

      Renderer.drawLine(
        this.lineSepColor,
        boundary1.x, boundary1.y,
        boundary2.x, boundary2.y,
        1
      );
    });
  }

  clicked() {
    const item = this.items[this.hoveredOption];

    if (item)
      (item.callback ?? this.callback)?.(item, this.gui);
  }

  keyTyped(_, key) {
    const item = this.mappedItems.find(item => item.key === key);
    
    if (item) 
      (item.callback ?? this.callback)?.(item, this.gui);
  }
}

export { RingSelector as default };
