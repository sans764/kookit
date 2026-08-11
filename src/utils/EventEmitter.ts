export default class {
  /**
   * Constructor
   */
  callbacks: any;
  constructor() {
    this.callbacks = {};
    this.callbacks.base = {};
  }

  /**
   * On
   */
  on(_names, callback) {
    const that = this;

    // Errors
    if (typeof _names === "undefined" || _names === "") {
      console.warn("wrong names");
      return false;
    }

    if (typeof callback === "undefined") {
      console.warn("wrong callback");
      return false;
    }

    // Resolve names
    const names = this.resolveNames(_names);

    // Each name
    names.forEach(function (_name) {
      // Resolve name
      const name: any = that.resolveName(_name);

      // Create namespace if not exist
      if (!(that.callbacks[name.namespace] instanceof Object))
        that.callbacks[name.namespace] = {};

      // Create callback if not exist
      if (!(that.callbacks[name.namespace][name.value] instanceof Array))
        that.callbacks[name.namespace][name.value] = [];

      // Add callback
      that.callbacks[name.namespace][name.value].push(callback);
    });

    return this;
  }

  /**
   * Off
   */
  off(_names) {
    const that = this;

    // Errors
    if (typeof _names === "undefined" || _names === "") {
      console.warn("wrong name");
      return false;
    }

    // Resolve names
    const names = this.resolveNames(_names);

    // Each name
    names.forEach(function (_name) {
      // Resolve name
      const name: any = that.resolveName(_name);

      // Remove namespace
      if (name.namespace !== "base" && name.value === "") {
        delete that.callbacks[name.namespace];
      }

      // Remove specific callback in namespace
      else {
        // Default
        if (name.namespace === "base") {
          // Try to remove from each namespace
          for (const namespace in that.callbacks) {
            if (
              that.callbacks[namespace] instanceof Object &&
              that.callbacks[namespace][name.value] instanceof Array
            ) {
              delete that.callbacks[namespace][name.value];

              // Remove namespace if empty
              if (Object.keys(that.callbacks[namespace]).length === 0)
                delete that.callbacks[namespace];
            }
          }
        }

        // Specified namespace
        else if (
          that.callbacks[name.namespace] instanceof Object &&
          that.callbacks[name.namespace][name.value] instanceof Array
        ) {
          delete that.callbacks[name.namespace][name.value];

          // Remove namespace if empty
          if (Object.keys(that.callbacks[name.namespace]).length === 0)
            delete that.callbacks[name.namespace];
        }
      }
    });

    return this;
  }

  /**
   * Trigger
   */
  trigger(_name, _args: any[] = []) {
    // Errors
    if (typeof _name === "undefined" || _name === "") {
      console.warn("wrong name");
      return false;
    }

    const that = this;
    let finalResult = null;
    let result = null;

    // Default args
    const args = !(_args instanceof Array) ? [] : _args;

    // Resolve names (should on have one event)
    let name = this.resolveNames(_name);

    // Resolve name
    name = this.resolveName(name[0]);
    setTimeout(() => {
      if (name.namespace === "base") {
        // Try to find callback in each namespace
        for (const namespace in that.callbacks) {
          if (
            that.callbacks[namespace] instanceof Object &&
            that.callbacks[namespace][name.value] instanceof Array &&
            that.callbacks[namespace][name.value]
          ) {
            that.callbacks[namespace][name.value].forEach(function (callback) {
              result = callback.apply(that, args);
              if (typeof finalResult === "undefined") {
                finalResult = result;
              }
            });
          } else if (
            this.callbacks[name.namespace] instanceof Object &&
            that.callbacks[name.namespace][name.value]
          ) {
            if (name.value === "") {
              console.warn("wrong name");
              return this;
            }
            that.callbacks[name.namespace][name.value].forEach(
              function (callback) {
                result = callback.apply(that, args);

                if (typeof finalResult === "undefined") finalResult = result;
              }
            );
          }
          return finalResult;
        }
      }
    }, 100);
    // Default namespace

    // Specified namespace
  }

  /**
   * Trigger registered callbacks without the legacy timer. Interactive
   * controls use this path so a busy renderer cannot delay user feedback.
   */
  triggerNow(_name, _args: any[] = []) {
    if (typeof _name === "undefined" || _name === "") {
      console.warn("wrong name");
      return false;
    }

    const args = !(_args instanceof Array) ? [] : _args;
    const names = this.resolveNames(_name);
    const name = this.resolveName(names[0]);
    let finalResult = null;

    const invokeCallbacks = (callbacks: any[]) => {
      callbacks.forEach((callback) => {
        const result = callback.apply(this, args);
        if (finalResult === null) finalResult = result;
      });
    };

    if (name.namespace === "base") {
      for (const namespace in this.callbacks) {
        const callbacks = this.callbacks[namespace]?.[name.value];
        if (callbacks instanceof Array) invokeCallbacks(callbacks);
      }
    } else {
      const callbacks = this.callbacks[name.namespace]?.[name.value];
      if (callbacks instanceof Array) invokeCallbacks(callbacks);
    }

    return finalResult;
  }

  /**
   * Resolve names
   */
  resolveNames(_names) {
    let names = _names;
    names = names.replace(/[^a-zA-Z0-9 ,/.]/g, "");
    names = names.replace(/[,/]+/g, " ");
    names = names.split(" ");

    return names;
  }

  /**
   * Resolve name
   */
  resolveName(name) {
    const newName: any = {};
    const parts = name.split(".");

    newName.original = name;
    newName.value = parts[0];
    newName.namespace = "base"; // Base namespace

    // Specified namespace
    if (parts.length > 1 && parts[1] !== "") {
      newName.namespace = parts[1];
    }

    return newName;
  }
}
