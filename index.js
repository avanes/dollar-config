'use strict';

const plugins = {
    $param(value, params, config) {
        if (typeof value === 'string') {
            return get(params, value);
        }
        const result = get(params, value[0]);
        return result === undefined ? config._resolve(value[1], params) : result;
    },

    $template(value, params) {
        return value.replace(/\$\{([^}]+)\}/g, (_, path) => get(params, path));
    },

    $guard(value, params, config) {
        const item = find(value, (item) => item[0] === '$default' || get(params, item[0]));
        return item && config._resolve(item[1], params);
    },

    $switch(value, params, config) {
        const test = get(params, value[0]);
        const item = find(value[1], (item) => item[0] === test || item[0] === '$default');
        return item && config._resolve(item[1], params);
    },

    $function(value, params, config) {
        if (typeof value === 'string') {
            return get(config._functions, value)(params);
        }
        const mergedParams = Object.assign({}, value[1], params);
        return get(config._functions, value[0])(mergedParams);
    }
};

const keywords = Object.keys(plugins);

class Config {
    /**
     * @param {object} data - Config data.
     * @param {object} [options] - Options.
     * @param {object} [options.functions] - Functions.
     */
    constructor(data, options) {
        this._data = data;
        this._functions = get(options, 'functions');
    }

    /**
     * Computes config value.
     *
     * @param {string|string[]} path - The path of the property to get.
     * @param {object} [params] - Dynamic params.
     * @returns {*} Config value.
     */
    get(path, params) {
        if (typeof path === 'string') {
            path = path.split('.');
        }

        const length = path.length;
        let value = this._data;
        let index = 0;

        while (value != null) {
            const isLast = index === length;
            if (params) {
                value = this._resolve(value, params, isLast);
            }
            if (isLast) {
                break;
            }
            const result = value[path[index++]];
            value = result === undefined ? value.$default : result;
        }

        return value;
    }

    /**
     * Resolves config value.
     *
     * @param {*} value - Config value.
     * @param {object} params - Dynamic params.
     * @param {boolean} [deep=false] - Recursively resolve nested properties.
     * @returns {*} Config value.
     */
    _resolve(value, params, deep) {
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                if (deep) {
                    return value.map((value) => this._resolve(value, params, true));
                }
            } else {
                const keyword = find(keywords, (keyword) => value[keyword]);

                if (keyword) {
                    return plugins[keyword](value[keyword], params, this);
                }

                if (deep) {
                    return Object.keys(value).reduce((result, key) => {
                        result[key] = this._resolve(value[key], params, true);
                        return result;
                    }, {});
                }
            }
        }

        return value;
    }

    /**
     * Binds config to params.
     *
     * @param {object} params - Dynamic params.
     * @returns {object} Bound config.
     */
    bind(params) {
        return this._bind(this._data, params);
    }

    /**
     * Binds config value to params.
     *
     * @param {*} value - Config value.
     * @param {object} params - Dynamic params.
     * @returns {*} Bound value.
     */
    _bind(value, params) {
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                return value.reduce(this._assign.bind(this, params), []);
            }

            const keyword = find(keywords, (keyword) => value[keyword]);

            if (keyword) {
                return plugins[keyword].bind(null, value[keyword], params, this);
            }

            return Object.keys(value).reduce((result, key) => {
                return this._assign(params, result, value[key], key);
            }, {});
        }

        return value;
    }

    /**
     * Binds array/object item.
     *
     * @param {object} params - Dynamic params.
     * @param {array|object} result - Target array/object.
     * @param {*} item - Array/object item.
     * @param {number|string} key - Index/key.
     * @returns {*} Target array/object.
     */
    _assign(params, result, item, key) {
        const bound = this._bind(item, params);
        if (typeof bound === 'function') {
            return Object.defineProperty(result, key, {
                configurable: true,
                enumerable: true,
                get: bound
            });
        }
        result[key] = bound;
        return result;
    }
}

// shim for IE
function find(array, callback) {
    let result;
    array.some((item) => {
        if (callback(item)) {
            result = item;
            return true;
        }
        return false;
    });
    return result;
}

function get(object, path) {
    path = path.split('.');
    const length = path.length;
    let index = 0;

    while (object != null && index < length) {
        object = object[path[index++]];
    }

    return object;
}

module.exports = Config;
