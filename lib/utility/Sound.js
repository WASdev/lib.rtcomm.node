var Sound = (function invocation(url) {

  /* global AudioContext:false */ 
  var context = null;

  if (typeof navigator !== 'undefined' && typeof window !== 'undefined') {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    context = context || (window.AudioContext) ? new AudioContext(): null;
  }

  var Sound = function Sound(url) {
    if (!(this instanceof Sound)) {
      return new Sound(url);
    }
    this.context = context;
    this.url = url;
    this.buffer = null;
    this.loaded = false;
    this.playing = null;
  };

/* global l:false */ 
Sound.prototype = (function () {
  var load = function load(callback) {
    var self = this;
    if (self.url && self.context) {
      var request = new XMLHttpRequest();
      request.open('GET', self.url, true);
      request.responseType= 'arraybuffer';
      request.onload = function() {
        self.context.decodeAudioData(request.response, 
          function(buffer) {
            l('DEBUG') && console.log('Sound: successfully loaded buffer '+ self.url);
            self.buffer = buffer;
            callback && callback();
          }, 
          function(error) { /* onError */
            console.error('Unable to load the url: ', error);
          });
      };
      request.send();
    } else {
      l('DEBUG') && console.log('Sound.play() Unsupported in this environment');
    }
    return self;
  };
  var play = function play() {
    var self = this;
    var _play = function _play() {
      if (self.context) {
        if (!self.playing) {
          var sound = self.context.createBufferSource();
          sound.buffer = self.buffer;
          sound.connect(self.context.destination);
          sound.loop= true;
          sound.start(0);
          self.playing = sound;
        } else {
          l('DEBUG') && console.log('Sound.play() Already playing...');
        }
      } else {
        l('DEBUG') && console.log('Sound.play() Unsupported in this environment');
      }
    };

    if (self.buffer) {
      _play();
    } else {
      // Try again in 500 milliseconds
      l('DEBUG') && console.log('Sound: Unable to play, Load is not complete -- will try 1 time in .5 seconds:',self);
      setTimeout(_play, 500);
    }
    return self;
  };

  var stop= function stop() {
    console.log('Sound.stop() stop called, are we playing?', this.playing);
    if (this.playing) {
      this.playing.stop();
      this.playing = null;
    } else {
      console.log('Sound.stop() -- Nothing playing');
    }
    return this;
  };
    return {
      load: load,
      play: play,
      stop: stop
    };
})();

return Sound;
})();

/*globals exports:false*/
module.exports = Sound;


