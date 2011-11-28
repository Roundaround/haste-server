///// represents a single document

var haste_document = function() {
  this.locked = false;
};

// Get this document from the server and lock it here
haste_document.prototype.load = function(key, callback, lang) {
  var _this = this;
  $.ajax('/documents/' + key, {
    type: 'get',
    dataType: 'json',
    success: function(res) {
      _this.locked = true;
      _this.key = key;
      _this.data = res.data;
      try {
        var high = lang ? hljs.highlight(lang, res.data) : hljs.highlightAuto(res.data);
      } catch(err) {
        // failed highlight, fall back on auto
        high = hljs.highlightAuto(res.data);
      }
      callback({
        value: high.value,
        key: key,
        language: high.language || lang
      });
    },
    error: function(err) {
      callback(false);
    }
  });
};

// Save this document to the server and lock it here
haste_document.prototype.save = function(data, callback) {
  if (this.locked) {
    return false;
  }
  this.data = data;
  var _this = this;
  $.ajax('/documents', {
    type: 'post',
    data: data,
    dataType: 'json',
    success: function(res) {
      _this.locked = true;
      _this.key = res.key;
      var high = hljs.highlightAuto(data);
      callback({
        value: high.value,
        key: res.key,
        language: high.language
      });
    }
  });
};

///// represents the paste application

var haste = function(appName, options) {
  this.appName = appName;
  this.baseUrl = window.location.href; // since this is loaded first
  this.$textarea = $('textarea');
  this.$box = $('#box');
  this.$code = $('#box code');
  this.options = options;
  this.configureShortcuts();
  this.configureButtons();
  // If twitter is disabled, hide the button
  if (!options.twitter) {
    $('#box2 .twitter').hide();
  }
};

// Set the page title - include the appName
haste.prototype.setTitle = function(ext) {
  var title = ext ? this.appName + ' - ' + ext : this.appName;
  document.title = title;
};

// Show the light key
haste.prototype.lightKey = function() {
  this.configureKey(['new', 'save']);
  this.removeClip();
};

// Show the full key
haste.prototype.fullKey = function() {
  this.configureKey(['new', 'duplicate', 'twitter', 'link']);
  this.configureClip();
};

// Set the key up for certain things to be enabled
haste.prototype.configureKey = function(enable) {
  var $this, i = 0;
  $('#box2 .function').each(function() {
    $this = $(this);
    for (i = 0; i < enable.length; i++) {
      if ($this.hasClass(enable[i])) {
        $this.addClass('enabled');
        return true;
      }
    }
    $this.removeClass('enabled');
  });
};

// Remove the current document (if there is one)
// and set up for a new one
haste.prototype.newDocument = function(hideHistory) {
  this.$box.hide();
  this.doc = new haste_document();
  if (!hideHistory) {
    window.history.pushState(null, this.appName, '/');
  }
  this.setTitle();
  this.lightKey();
  this.$textarea.val('').show('fast', function() {
    this.focus();
  });
};

// Map of common extensions
haste.extensionMap = {
    rb: 'ruby', py: 'python', pl: 'perl', php: 'php', scala: 'scala', go: 'go',
    xml: 'xml', html: 'xml', htm: 'xml', css: 'css', js: 'javascript', vbs: 'vbscript',
    lua: 'lua', pas: 'delphi', java: 'java', cpp: 'cpp', cc: 'cpp', m: 'objectivec',
    vala: 'vala', cs: 'cs', sql: 'sql', sm: 'smalltalk', lisp: 'lisp', ini: 'ini',
    diff: 'diff', bash: 'bash', sh: 'bash', tex: 'tex', erl: 'erlang', hs: 'haskell',
    md: 'markdown'
};

// Map an extension to a language
haste.prototype.lookupExtension = function(ext) {
  var match = haste.extensionMap[ext];
  return match; // if not found, will auto-detect
};

// Load a document and show it
haste.prototype.loadDocument = function(key) {
  // Split the key up
  var parts = key.split('.', 2);
  // Ask for what we want
  var _this = this;
  _this.doc = new haste_document();
  _this.doc.load(parts[0], function(ret) {
    if (ret) {
      _this.$code.html(ret.value);
      var title = ret.key;
      if (ret.language) {
        title += ' - ' + ret.language;
      }
      _this.setTitle(title);
      _this.fullKey();
      _this.$textarea.val('').hide();
      _this.$box.show().focus();
    }
    else {
      _this.newDocument();
    }
  }, this.lookupExtension(parts[1]));
};

// Duplicate the current document - only if locked
haste.prototype.duplicateDocument = function() {
  if (this.doc.locked) {
    var currentData = this.doc.data;
    this.newDocument();
    this.$textarea.val(currentData);
  }
};

// Lock the current document
haste.prototype.lockDocument = function() {
  var _this = this;
  this.doc.save(this.$textarea.val(), function(ret) {
    if (ret) {
      _this.$code.html(ret.value);
      var title = ret.key;
      if (ret.language) {
        title += ' - ' + ret.language;
      }
      _this.setTitle(title);
      window.history.pushState(null, _this.appName + '-' + ret.key, '/' + ret.key);
      _this.fullKey();
      _this.$textarea.val('').hide();
      _this.$box.show().focus();
    }
  });
};

// set up a clip that will copy the current url
haste.prototype.configureClip = function() {
  var clip = this.clipper = new ZeroClipboard.Client();
  this.clipper.setHandCursor(true);
  this.clipper.setCSSEffects(false);
  // and then set and show
  this.clipper.setText(window.location.href);
  $('#box2 .link').html(this.clipper.getHTML(32, 37));
};

// hide the current clip, if it exists
haste.prototype.removeClip = function() {
  if (this.clipper) {
    this.clipper.destroy();
  }
  $('#box2 .link').html('');
};

haste.prototype.configureButtons = function() {
  var _this = this;
  this.buttons = [
    {
      $where: $('#box2 .save'),
      label: 'Save',
      shortcutDescription: 'control + s',
      shortcut: function(evt) {
        return evt.ctrlKey && (evt.keyCode === 76 || evt.keyCode === 83);
      },
      action: function() {
        if (_this.$textarea.val().replace(/^\s+|\s+$/g, '') !== '') {
          _this.lockDocument();
        }
      }
    },
    {
      $where: $('#box2 .new'),
      label: 'New',
      shortcut: function(evt) {
        return evt.ctrlKey && evt.keyCode === 78  
      },
      shortcutDescription: 'control + n',
      action: function() {
        _this.newDocument(!_this.doc.key);
      }
    },
    {
      $where: $('#box2 .duplicate'),
      label: 'Duplicate & Edit',
      shortcut: function(evt) {
        return _this.doc.locked && evt.ctrlKey && evt.keyCode === 68;
      },
      shortcutDescription: 'control + d',
      action: function() {
        _this.duplicateDocument();
      }
    },
    {
      $where: $('#box2 .twitter'),
      label: 'Twitter',
      shortcut: function(evt) {
        return _this.options.twitter && _this.doc.locked && evt.ctrlKey && evt.keyCode == 84;
      },
      shortcutDescription: 'control + t',
      action: function() {
        window.open('https://twitter.com/share?url=' + encodeURI(_this.baseUrl + _this.doc.key));
      }
    },
    {
      $where: $('#box2 .link'),
      label: 'Copy URL',
      letBubble: true,
      action: function() { }
    }
  ];
  for (var i = 0; i < this.buttons.length; i++) {
    this.configureButton(this.buttons[i]);
  }
};

haste.prototype.configureButton = function(options) {
  // Handle the click action
  options.$where.click(function(evt) {
    evt.preventDefault();
    if ($(this).hasClass('enabled')) {
      options.action();
    }
  });
  // Show the label
  options.$where.mouseenter(function(evt) {
    $('#box3 .label').text(options.label);
    $('#box3 .shortcut').text(options.shortcutDescription || '');
    $('#box3').show();
    $(this).append($('#pointer').remove().show());
  });
  // Hide the label
  options.$where.mouseleave(function(evt) {
    $('#box3').hide();
    $('#pointer').hide();
  });
};

// Configure keyboard shortcuts for the textarea
haste.prototype.configureShortcuts = function() {
  var _this = this;
  $(document.body).keydown(function(evt) {
    var button;
    for (var i = 0 ; i < _this.buttons.length; i++) {
      button = _this.buttons[i];
      if (button.shortcut && button.shortcut(evt)) {
        if (!button.letBubble) {
          evt.preventDefault();
        }
        button.action();
        return;
      }
    }
  });
};

///// Tab behavior in the textarea - 2 spaces per tab
$(function() {

  $('textarea').keydown(function(evt) {
    if (evt.keyCode === 9) {
      evt.preventDefault();
      var myValue = '  ';
      // http://stackoverflow.com/questions/946534/insert-text-into-textarea-with-jquery
      // For browsers like Internet Explorer
      if (document.selection) {
        this.focus();
        sel = document.selection.createRange();
        sel.text = myValue;
        this.focus();
      }
      // Mozilla and Webkit
      else if (this.selectionStart || this.selectionStart == '0') {
        var startPos = this.selectionStart;
        var endPos = this.selectionEnd;
        var scrollTop = this.scrollTop;
        this.value = this.value.substring(0, startPos) + myValue +
          this.value.substring(endPos,this.value.length);
        this.focus();
        this.selectionStart = startPos + myValue.length;
        this.selectionEnd = startPos + myValue.length;
        this.scrollTop = scrollTop;
      }
      else {
        this.value += myValue;
        this.focus();
      }
    }
  });

});
