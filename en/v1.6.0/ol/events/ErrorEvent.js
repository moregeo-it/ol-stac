/**
 * @module ol/events/ErrorEvent
 */
import BaseEvent from 'ol/events/Event.js';
import EventType from 'ol/events/EventType.js';
/**
 * @classdesc
 * Event emitted on configuration or loading error.
 * @api
 */
class ErrorEvent extends BaseEvent {
    /**
     * @param {Error} error error object.
     * @api
     */
    constructor(error) {
        super(EventType.ERROR);
        /**
         * @type {Error}
         * @api
         */
        this.error = error;
    }
}
export default ErrorEvent;
//# sourceMappingURL=ErrorEvent.js.map