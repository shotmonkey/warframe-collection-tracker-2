import log from './logging';

const DEFAULT_CACHED_PROMISE_TIME = 5 * 1000;

export class CachedPromise {

    constructor(func, delay = DEFAULT_CACHED_PROMISE_TIME) {

        this.func = func;
        this.result = null;

        this.delayTime = delay;
        this.promise = null;
        this.delayTimeout = null;

    }

    onPromiseComplete() {
        this.promise = null;
        this.delayTimeout = setTimeout(() => {
            this.delayTimeout = null;
        }, this.delayTime);
    }

    callFunc(context, args) {
        this.promise = this.func.apply(context, args)
            .then(result => {
                this.result = result;
                return result;
            })
            .finally(() => this.onPromiseComplete.call(this, context, args));
        return this.promise;
    }

    createWrappedFunc() {

        const _this = this;

        return function() {

            log.debug(_this.__proto__.constructor.name, `"${_this.func.name}"`);

            if (_this.promise) {
                log.debug('CachedPromise', 'Promise already running');
                if (_this.result) {
                    log.debug('CachedPromise', 'Returning previous result');
                    return Promise.resolve(_this.result);
                } else {
                    log.debug('CachedPromise', 'No previous result, returning current promise');
                    return _this.promise;
                }
            }

            if (_this.delayTimeout && _this.result) {
                log.debug('CachedPromise', 'Delay timeout running, returning previous result');
                return Promise.resolve(_this.result);
            }

            log.debug('CachedPromise', 'Creating new promise by calling original func');
            _this.promise = _this.callFunc(this, arguments);

            log.debug('CachedPromise', 'Returning new promise');
            return _this.promise;

        };
    }

}

export function cachedPromise(func, delay) {
    let cachedPromise = new CachedPromise(func, delay);
    return cachedPromise.createWrappedFunc();
}

export class RepeatingCachedPromise extends CachedPromise {
    onPromiseComplete(context, args) {
        this.promise = null;
        this.delayTimeout = setTimeout(() => {
            this.delayTimeout = null;
            this.callFunc(context, args);
        }, this.delayTime);
    }
}

export function repeatingCachedPromise(func, delay) {
    let repeatingCachedPromise = new RepeatingCachedPromise(func, delay);
    return repeatingCachedPromise.createWrappedFunc();
}