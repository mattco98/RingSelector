import RingSelector from './index';

const randItems = str => {
  var arr = [];
  var n = Math.floor(Math.random() * 4) + 2
  for (var i = 0; i < n; i++) {
    arr.push(str + i);
  }
  return arr
}

var subSelectors = [1, 2, 3].map(n => new RingSelector({
  items: randItems('primary' + n + '-sub'),
  callback: (item, gui) => {
    gui.close();
    ChatLib.chat('Selected item: ' + item);
  }
}));

var mid = () => Renderer.screen.getWidth() / 2;
var cX = mid() - 50;
var dir = 0;

var mainSelector = new RingSelector({
  // Demonstrates items as strings and objects, as well
  // as all item customizable options
  items: [
    'primary1',
    { 
      name: new Text('primary2', 0, 0).setColor(Renderer.GREEN).setScale(1.0), 
      outerRadius: () => Renderer.screen.getHeight() / 4,
      key: Keyboard.KEY_N,
      callback: (_, gui) => {
        gui.close();
        ChatLib.chat('Custom primary2 callback');
      }
    },
    {
      name: 'primary3',
      width: Math.PI * 3 / 2,
      innerRadius: 0,
      bgColor: Renderer.color(150, 150, 0, 100),
      fgColor: Renderer.color(150, 150, 0, 200)
    }
  ],
  rotOffset: Math.PI / 5,
  clockwise: true,
  center: [
    () => {
      if (dir === 0) cX += 0.05;
      else           cX -= 0.05;

      if (cX > mid() + 50)      dir = 1;
      else if (cX < mid() - 50) dir = 0;

      return cX;
    },
    () => Renderer.screen.getHeight() / 2
  ],
  callback: (item, gui) => {
    gui.close();
    
    // Lookup table instead of switch statement
    ({
      primary1: subSelectors[0],
      primary2: subSelectors[1],
      primary3: subSelectors[2]
    })[item.name || item].open()
  }
});

register('command', mainSelector.open.bind(mainSelector)).setName('selector');