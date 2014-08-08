var Log = function Log() {
    var LOG_LEVEL = {"MESSAGE": 1,// bin '01' Only MESSAGE lines
        "INFO": 2,  // bin '10'   -- Only Info Messages
        "EVENT": 4, // bin '100'  -- Only EVENT lines
        "DEBUG": 7, // bin '111'  -- DEBUG + INFO + EVENT + MESSAGE 
        "TRACE": 15 }; // bin '1111' (includes) all
    var logLevel = 'INFO';
    this.l = function l(value, obj) {
      
      var ll = (obj && obj.getLogLevel ) ? obj.getLogLevel() : logLevel;
        /*jslint bitwise: true */
            return (LOG_LEVEL[ll] & LOG_LEVEL[value]) === LOG_LEVEL[value];
    };  
    this.log = function log(msg)  {
      console.log(msg);
    };  
    this.setLogLevel = this.s = function(value) {
        if (value in LOG_LEVEL) {
          logLevel = value;
          return true;
        } else {
          throw new Error(value + 'is not a valid Log level, try: '+JSON.stringify(LOG_LEVEL));
        }   
      };  
      
    this.getLogLevel = this.g = function(value) {
       return logLevel;
    };  
};

module.exports = new Log();

