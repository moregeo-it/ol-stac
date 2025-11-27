export default ErrorEvent;
/**
 * @classdesc
 * Event emitted on configuration or loading error.
 * @api
 */
declare class ErrorEvent extends BaseEvent {
    /**
     * @param {Error} error error object.
     * @api
     */
    constructor(error: Error);
    /**
     * @type {Error}
     * @api
     */
    error: Error;
}
import BaseEvent from 'ol/events/Event.js';
//# sourceMappingURL=ErrorEvent.d.ts.map