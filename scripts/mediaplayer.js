// Classes and Ids for Elements
const prefix = "browserscreen-";
const identifiers = {
    style: prefix + "videoControlsStyle",
    buttons: prefix + "controls-btn",
    slider: prefix + "slider",
    sliderHandle: prefix + "slider-handle",
    sliderBars: prefix + "slider-bars",
    sliderBarMain: prefix + "slider-bar-main",
    sliderBarBuffer: prefix + "slider-bar-buffer",
    volSlider: prefix + "volume-slider",
    progressSlider: prefix + "progress-slider",

    timeDisplay: prefix + "time-display",
    timeCurr: prefix + "time-current",
    timeTotal: prefix + "time-total",

    qualityLabel: prefix + "quality-label",
    playSpeed: prefix + "playback-speed",

    container: prefix + "videoControls",
    subContainer: prefix + "sub-container",
    leftContainer: prefix + "controls-leftContainer",
    rightContainer: prefix + "controls-rightContainer",

    previewTime: prefix + "progress-bar-time",

    loading: prefix + "loading-icon"
};

// Values for Elements
const values = {
    volSliderWidth: 52,
    progressHeight: 3,
    progressContainer: 16,

    loadingSize: 90,

    rewindAmount: 10,

    playbackRates: [
        0.25,
        0.5,
        1,
        1.25,
        1.5,
        2
    ]
};

/** @class MediaPlayer
 *
 * @var {HTML5Element} video - Video Element for Controls
 * @var {Container} container - Container Class as Root for all Controls Element // TEMP: Can be deleted if saving not needed
 *
 * @constructor
 *  @param {HTML5Element} video - Video Element
 *
 * @function createStyle - create Main Style used for this chrome extension
 *  @return {HTML5Element} - style element for document.head
 *
 */
class MediaPlayer{
    static get debugging(){ return true; }
    static get controlsHeight(){ return 36; }
    static get idler(){ return 0; }

    constructor(video){
        this.video = video;

        // Create Container Layout
        let leftContainer = new Container(identifiers.leftContainer);
        let rightContainer = new Container(identifiers.rightContainer);
        let subContainer = new Container(identifiers.subContainer);
        let container = new Container(identifiers.container);
        container.append(subContainer);

        document.body.appendChild(container.node);
        document.head.appendChild(this.createStyle());

        // Create Controls
        let playBtn = this.createPlayButton();
        let volumeBtn = this.createVolumeButton();
        let forwardBtn = this.createForwardButton();
        let rewindBtn = this.createRewindButton();
        let fullscreenBtn = this.createFullscreenButton();
        let volumeSlider = this.createVolumeSlider();
        let progressBar = this.createProgressBar();

        // Add Controls to Containers
        leftContainer.appendMultiple([rewindBtn, playBtn, forwardBtn, volumeBtn, volumeSlider]);
        rightContainer.appendMultiple([fullscreenBtn]);
        subContainer.appendMultiple([progressBar, leftContainer, rightContainer]);

        [volumeSlider, progressBar].forEach((item) => {
            item.init();
        });

        // Add Event Listener to Video
        this.videoEvents = new VideoEvent(video);
        this.videoEvents.addEvents(["play", "pause", "ended"], [playBtn]);
        this.videoEvents.addEvent("volumechange", [volumeBtn, volumeSlider]);
        this.videoEvents.addEvent("webkitfullscreenchange", [fullscreenBtn]);
        this.videoEvents.addEvent("timeupdate", [progressBar]);
        this.videoEvents.addEvent("progress", [progressBar.getPassiveSlider(0)]);
    }

    removeControls(){
        // Remove Controls Container
        let container = document.querySelector("." + identifiers.container);
        if(container != null) container.parentNode.removeChild(container);

        // Remove Controls Style
        let style = document.querySelector("#" + identifiers.style);
        if(style != null) style.parentNode.removeChild(style);

        // Remove all custom settings from Video
        this.videoEvents.removeAll();
        this.video.style.cursor = "";
        this.video = null;
    }

    createFullscreenButton(){
        return this.createButton([
            {name: "fullscreen", condition: () => document.webkitFullscreenElement == null, action: () => this.video.webkitRequestFullscreen()},
            {name: "exitFullscreen", condition: () => document.webkitFullscreenElement == this.video, action: () => document.webkitExitFullscreen()}
        ]);
    }
    createRewindButton(){
        return this.createButton([
            {name: "rewind", condition: () => true, action: () => this.video.currentTime -= values.rewindAmount}
        ]);
    }
    createForwardButton(){
        return this.createButton([
            {name: "fastForward", condition: () => true, action: () => this.video.currentTime += values.rewindAmount}
        ]);
    }
    createVolumeButton(){
        let mute = function(){
            this.video.muted = true
            this.savedVolume = this.video.volume;
            this.video.volume = 0;
        }
        return this.createButton([
            {name: "muted", condition: () => this.video.muted || this.video.volume == 0, action: () => {
                this.video.muted = false;
                if(this.savedVolume != null){
                    this.video.volume = this.savedVolume;
                    this.savedVolume = null;
                }
                if(this.video.volume == 0) this.video.volume = 1;
            }},
            {name: "volumeHigh", condition: () => !this.video.muted && this.video.volume >= .5, action: mute.bind(this)},
            {name: "volumeLow", condition: () => !this.video.muted && this.video.volume < .5, action: mute.bind(this)}
        ]);
    }
    createPlayButton(){
        return this.createButton([
            {name: "play", condition: () => this.video.paused, action: () => this.video.play()},
            {name: "pause", condition: () => !this.video.paused, action: () => this.video.pause()},
            {name: "replay", condition: () => this.video.ended, action: () => this.video.play()}
        ]);
    }
    createButton(states){
        let btn = new Button();
        states.forEach((item) => {
            btn.addState(item.name, item.condition, item.action);
        });
        return btn;
    }

    createVolumeSlider(){
        let slider = new Slider({
            valueFn: () => this.video.volume,
            min: 0,
            max: 1,
            updateValue: (newValue) => this.video.volume = newValue
        });
        slider.whileDrag(() => {
            if(this.video.volume > 0) this.video.muted = false;
            if(this.video.volume == 0) this.video.muted = true;
        });
        slider.setLabel("Volume");
        slider.addClass(identifiers.volSlider);
        return slider;
    }
    createProgressBar(){
        let bufferProgress = new PassiveSlider({
            valueFn: () => this.getCurrentBuffer(this.video),
            min: 0,
            max: this.video.duration,
        }, identifiers.sliderBarBuffer);

        let progress = new Slider({
            valueFn: () => this.video.currentTime,
            min: 0,
            max: this.video.duration,
            updateValue: (newValue) => this.video.currentTime = newValue
        }, [bufferProgress]);
        progress.beforeDrag(() => {
            progress.wasPaused = this.video.paused;
            this.video.pause();
        });
        progress.afterDrag(() => {
            if(!progress.wasPaused)
                this.video.play();
        });
        progress.setLabel("Video Progress");
        progress.addClass(identifiers.progressSlider);
        progress.setRealtime(false);

        return progress;
    }
    getCurrentBuffer(video){
        // Get Index of closest Buffer Range to current Time
        var buffers = video.buffered;
        var index = 0;
        for(var i = 0; i < buffers.length; i++){
            var bufferEnd = buffers.end(i);
            var lastBuffer = buffers.end(index);
            if(bufferEnd > video.currentTime){
                if(lastBuffer <= video.currentTime || (lastBuffer > video.currentTime && bufferEnd < lastBuffer)){
                    index = i;
                }
            }
        }

        // Return Buffer Time
        return video.buffered.end(index);
    }

    createStyle(){
        let css = `
            video::-webkit-media-controls-enclosure{
                display: none !important;
            }

            /* Container Styles */
            .${identifiers.container}{
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 0 0.7em;
                z-Index: 2147483647;
                font-family: Roboto, Arial, sans-serif;
                font-size: 12px;
                text-align: center;
                -webkit-user-select: none;
                line-height: ${MediaPlayer.controlsHeight}px;
                height: ${MediaPlayer.controlsHeight}px;
                transition: height .2s;
            }
            .${identifiers.subContainer}{
                height: 100%;
                display: inline-flex;
                justify-content: space-between;
                position: relative;
                width: 100%;
                color: #CCC;
                background: rgba(0,0,0,0.6);
            }
            .${identifiers.leftContainer}, .${identifiers.rightContainer}{
                display: inline-flex;
            }

            /* Button Styles */
            .${identifiers.buttons}, .${identifiers.playSpeed}, .${identifiers.playSpeed} ul{
                border: none !important;
                background: none !important;
                cursor: pointer;
                outline: 0;
                width: ${Button.buttonWidth}px;
                padding: 0 !important;
                margin: 0;
                position: relative;
            }
            .${identifiers.buttons}:hover path{
                fill: white;
            }
            .${identifiers.timeDisplay}, .${identifiers.qualityLabel}{
                padding: 0 0.7em;
                max-width: 200px;
            }
            .${identifiers.playSpeed} ul{
                position: absolute;
                bottom: ${(MediaPlayer.controlsHeight + values.progressContainer)}px;
                left: 0;
                list-style: none;
                line-height: 25px;
                display: none;
                background: rgba(0,0,0,0.6) !important;
            }
            .${identifiers.playSpeed} li:hover{
                background: rgba(60,60,60,0.8);
            }
            .${identifiers.playSpeed} span{
                display: block;
            }
            .${identifiers.previewTime}{
                position: absolute;
                background: rgba(80,80,80,0.7);
                height: 12px;
                padding: 0.4em;
                line-height: 12px;
                top: -20px;
                display: none;
            }

            /* Slider Styles */
            .${identifiers.progressSlider}{
                position: absolute !important;
                top: -${(Slider.sliderBarHeight + values.progressContainer) / 2}px;
                left: 0;
                right: 0;
                height: ${values.progressContainer}px !important;
            }
            .${identifiers.progressSlider}:hover{
                position: absolute !important;
                top: -${(Slider.sliderBarHeight + values.progressContainer) / 2}px;
                left: 0;
                right: 0;
                height: ${values.progressContainer}px !important;
            }
            .${identifiers.progressSlider} .${identifiers.sliderHandle}{
                transform: scale(0);
                background: red;
            }
            .${identifiers.progressSlider}:hover .${identifiers.sliderHandle}, .${identifiers.progressSlider}:focus .${identifiers.sliderHandle}{
                transform: scale(1);
            }
            .${identifiers.volSlider} .${identifiers.sliderBarMain}, .${identifiers.playSpeed} span:hover{
                background: white;
            }
            .${identifiers.volSlider}{
                width: ${values.volSliderWidth}px;
            }
            .${identifiers.slider}{
                display: inline-block;
                position: relative;
                height: 100%;
                cursor: pointer;
            }
            .${identifiers.slider}::after{
                content: '';
                display: block;
                background: rgba(255,255,255,0.2);
            }
            .${identifiers.sliderBars}, .${identifiers.slider}::after{
                position: absolute;
                height: ${Slider.sliderBarHeight}px;
                margin-top: -${Slider.sliderBarHeight - 1}px;
                width: 100%;
                top: 50%;
            }
            .${identifiers.sliderHandle}{
                position: absolute;
                top: 50%;
                width: ${Slider.sliderHandleSize}px;
                height: ${Slider.sliderHandleSize}px;
                border-radius: ${Slider.sliderHandleSize / 2}px;
                margin-top: -${Slider.sliderHandleSize / 2}px;
                background: white;
                transform-origin: 50% 50%;
                transition: transform 0.1s ease-out;
            }
            .${identifiers.sliderBarMain}, .${identifiers.sliderBarBuffer}{
                height: 100%;
                position: absolute;
                width: 100%;
                left: 0;
                top: 0;
                transform-origin: 0% 50%;
                transform: scaleX(0);
            }
            .${identifiers.sliderBarMain}{
                background: red;
            }
            .${identifiers.sliderBarBuffer}{
                background: rgba(150,150,150,0.8);
            }

            /* Loading Styles */
            .${identifiers.loading}{
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: ${values.loadingSize}px;
                height: ${values.loadingSize}px;
                border-radius: 50%;
            }
            .${identifiers.loading} .circular{
              animation: rotate 2s linear infinite;
              height: 100%;
              transform-origin: center center;
              width: 100%;
              margin: auto;
            }
            .${identifiers.loading} .path{
              stroke-dasharray: 1, 200;
              stroke-dashoffset: 0;
              animation: dash 1.5s ease-in-out infinite;
              stroke-linecap: round;
              stroke: rgba(180,180,180,1);
            }
            @keyframes rotate {
              100% {
                transform: rotate(360deg);
              }
            }
            @keyframes dash {
              0% {
                stroke-dasharray: 1, 200;
                stroke-dashoffset: 0;
              }
              50% {
                stroke-dasharray: 89, 200;
                stroke-dashoffset: -35px;
              }
              100% {
                stroke-dasharray: 89, 200;
                stroke-dashoffset: -124px;
              }
            }
        `;

        // Create Style and return
        let style = document.createElement("STYLE");
        style.id = identifiers.style;
        style.innerHTML = css;
        return style;
    }
}

/** @class VideoEvent
 *  @desc Manages all events from a video
 *
 * @var {HTML5Element} video - Video where EventListener are added
 * @var {Array[String]} events - List of all events with their funtions, used for removing events
 *
 * @function addEvent - Add Event to Video with list of listener updating
 *  @param {String} event - Event for video
 *  @param {Array[Listener]} listeners - all listeners updating on event
 *
 * @function addEvents - Add mutiple Events for listeners
 *  @param {Array[String]} events
 *  @param {Array[Listeners]} listeners
 *
 * @function removeAll - Remove all events from video
 *
 */
class VideoEvent{
    constructor(video){
        this.video = video;
        this.events = new Array();
    }
    addEvent(event, listeners){
        let eventFn = function(){
            listeners.forEach((item) => {
                item.update();
            });
        }
        this.video.addEventListener(event, eventFn);

        this.events.push({ev: event, fn: eventFn});
    }
    addEvents(events, listeners){
        events.forEach((item) => {
            this.addEvent(item, listeners);
        });
    }
    removeAll(){
        this.events.forEach((item) =>{
            this.video.removeEventListener(item.ev, item.fn);
        });
    }
}

/** @interface Controls
 *  @desc Implemented from all that has something to be shown in HTML
 *
 * @var {HTML5Element} node - Element shown in HTML
 */

/** @interface Listener
 *  @desc Implemented from all that can listen to a video event
 *
 * @function update - Update Object/HTML View after Listener Event occurred
 */

/** @class Button @implements {Controls, Listener}
 *  @desc Controls Button with SVG Icon that has a condition when it is shown and an action that activates on click
 *
 * @static @const @var {Object} paths - Contains SVG path values for different button icons
 * @var {Array} states - Contains all states of this button
 * @var {Int} activeState - Index of current active state
 * @var {HTML5Element} node - Button Element shown in HTML from @interface Controls
 *
 * @function addState - Adding state/icon to button + save current @var activeState
 *  @param {String} label - Identifier for state
 *  @param {Function()} condition - Describes when state/icon should be shown // WARNING: should not overlap
 *  @param {Function()} action - Event when button is clicked with this state
 *
 * @function update - Update Button Icon after Listener Event from @interface Listener
 *
 * @private @function changeState - Changing state/icon of button
 *  @param {Int} index
 *
 */
class Button {
    static get buttonWidth(){ return 46; }
    static get paths(){
        return {
            play: "M 12,26 12,10 25,18 Z",
            pause: "M 12,26 16,26 16,10 12,10 z M 21,26 25,26 25,10 21,10 z",
            replay: "M 18,11 V 7 l -5,5 5,5 v -4 c 3.3,0 6,2.7 6,6 0,3.3 -2.7,6 -6,6 -3.3,0 -6,-2.7 -6,-6 h -2 c 0,4.4 3.6,8 8,8 4.4,0 8,-3.6 8,-8 0,-4.4 -3.6,-8 -8,-8 z",

            muted: "M 21.48 17.98 C 21.48 16.21 20.46 14.69 18.98 13.95 L 18.98 16.16 L 21.43 18.61 C 21.46 18.41 21.48 18.2 21.48 17.98 Z  M 23.98 17.98 C 23.98 18.92 23.78 19.8 23.44 20.62 L 24.95 22.13 C 25.61 20.89 25.98 19.48 25.98 17.98 C 25.98 13.7 22.99 10.12 18.98 9.22 L 18.98 11.27 C 21.87 12.13 23.98 14.81 23.98 17.98 Z  M 7.98 10.24 L 12.7 14.97 L 7.98 14.97 L 7.98 20.97 L 11.98 20.97 L 16.98 25.97 L 16.98 19.24 L 21.23 23.49 C 20.56 24.01 19.81 24.42 18.98 24.67 L 18.98 26.73 C 20.36 26.42 21.61 25.78 22.67 24.92 L 24.71 26.97 L 25.98 25.7 L 16.98 16.7 L 9.26 8.98 L 7.98 10.24 Z  M 14.88 12.05 L 16.97 14.14 L 16.97 9.98 L 14.88 12.05 Z",
            volumeHigh: "M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z",
            volumeLow: "M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 Z",

            rewind: "M 18.204 20.541 L 18.204 26.317 L 12.602 22.158 L 7 18 L 12.602 13.842 L 18.204 9.683 L 18.204 15.459 L 20.383 13.842 L 25.985 9.683 L 25.985 18 L 25.985 26.317 L 20.383 22.158 L 18.204 20.541 Z",
            fastForward: "M 17.781 20.541 L 17.781 26.317 L 23.383 22.158 L 28.985 18 L 23.383 13.842 L 17.781 9.683 L 17.781 15.459 L 15.602 13.842 L 10 9.683 L 10 18 L 10 26.317 L 15.602 22.158 L 17.781 20.541 Z",

            fullscreen: "M 10 16 L 12 16 L 12 12 L 16 12 L 16 10 L 10 10 L 10 16 L 10 16 Z  M 12 20 L 10 20 L 10 26 L 16 26 L 16 24 L 12 24 L 12 20 L 12 20 Z  M 26 16 L 24 16 L 24 12 L 20 12 L 20 10 L 26 10 L 26 16 L 26 16 Z  M 24 20 L 26 20 L 26 26 L 20 26 L 20 24 L 24 24 L 24 20 L 24 20 Z",
            exitFullscreen: "M 14 14 L 10 14 L 10 16 L 16 16 L 16 10 L 14 10 L 14 14 L 14 14 Z  M 22 14 L 22 10 L 20 10 L 20 16 L 26 16 L 26 14 L 22 14 L 22 14 Z  M 20 26 L 22 26 L 22 22 L 26 22 L 26 20 L 20 20 L 20 26 L 20 26 Z  M 10 22 L 14 22 L 14 26 L 16 26 L 16 20 L 10 20 L 10 22 L 10 22 Z"
        }
    }
    constructor(){
        this.states = new Array();
        this.activeState = -1;

        // Create Generic Button
        this.node = document.createElement("BUTTON");
        this.node.classList.add(identifiers.buttons);
        this.node.innerHTML = '<svg viewBox="0 0 36 36" width="36" height="36"><path fill="#CCC"/></svg>';
        this.node.addEventListener("click", () => this.states[this.activeState].action());
    }
    addState(label, condition, action){
        this.states.push({label: label, condition: condition, action: action});

        // While Adding State, save current active State
        if(condition()){
            this.changeState(this.states.length - 1);
        }
    }
    update(){
        this.states.forEach((item, index) =>{
            if(item.condition()){
                this.changeState(index);
            }
        });
    }
    changeState(index){
        this.activeState = index;
        let label = this.states[this.activeState].label;

        // Change Button Icon
        let btn = this.node;
        btn.setAttribute("aria-label", label);
        btn.querySelector("path").setAttribute("d", Button.paths[label])
    }
}

/** @class Slider @implements {Controls, Listener}
 *  @desc Controls Slider with fixed sizes
 *
 * @var {Function()} value - Get current value of object to be watched
 * @var {Int} min - Minimum value of @var value
 * @var {Int} max - Maximum value of @var value
 * @var {Function(newValue)} action - Action to be done when slider is dragged, passing new value
 * @var {Container} slider - Containing Main Container for Slider Element
 * @var {HTML5Element} node - Slider Node shown in HTML from @interface Controls
 * @private @var {Int} realWidth - Real Width of Slider considering the Slider Handle Width
 * @private @var {Boolean} dragging - Used to check if dragging is active
 * @private @var {String} label - Used for aria-label attribute
 * @private @var {Int} currOffset - Current Offset for Slider depending on Video Volume
 * @private @var {Boolean} realtime - Whether update of value should happen in realtime @default true
 *
 * @constructor
 *  @param {Function()} changeVal -@see @var value
 *  @param {Int} min - @see @var min
 *  @param {Int} max - @see @var max
 *  @param {Function(newValue)} action - @see @var action
 *
 * @function setLabel - set aria-label value @see @var label
 *  @param {String} label
 *
 * @function addClass - add class to node
 *  @param {String} className
 *
 * @function update - Update Slider Node on video event change from @interface Listener
 *
 * @private @function createSlider - Create Slider Node
 * @private @function changeValue - Change Value depending on relative x inside slider
 *
 */
class Slider{
    static get sliderHandleSize(){ return 12; }
    static get sliderBarHeight(){ return 3; }

    get valuePercent(){
        return this.valueFn() / this.max;
    }
    constructor(values, passiveSlider = []){
        this.valueFn = values.valueFn;
        this.min = values.min;
        this.max = values.max;
        this.updateValue = values.updateValue;
        this.realtime = true;
        this.dragging = false;

        this.passiveSliders = passiveSlider;
        this.slider = this.createSlider();
        this.node = this.slider.node;
        this.handle = this.node.querySelector("." + identifiers.sliderHandle);
        this.sliderBarMain = this.node.querySelector("." + identifiers.sliderBarMain);
    }
    setRealtime(value){
        this.realtime = value;
    }
    setLabel(label){
        this.label = label;
    }
    addClass(className){
        this.slider.addClass(className);
    }

    getPassiveSlider(index = -1){
        if(index < 0){
            return this.passiveSliders;
        }else{
            return this.passiveSliders[index];
        }
    }

    beforeDrag(fn){
        this.beforeDrag = fn;
    }
    whileDrag(fn){
        this.whileDrag = fn;
    }
    afterDrag(fn){
        this.afterDrag = fn;
    }

    createSlider(){
        let slider = new Container(identifiers.slider);
        let sliderHandle = new Container(identifiers.sliderHandle);
        let sliderBars = new Container(identifiers.sliderBars);
        let sliderBarMain = new Container(identifiers.sliderBarMain);
        sliderBars.appendMultiple(this.passiveSliders);
        sliderBars.append(sliderBarMain);
        slider.appendMultiple([sliderBars, sliderHandle]);

        // Add EventListener to enable dragging slider
        slider.node.addEventListener("mousedown", (e) => {
            this.dragging = true;
            if(this.beforeDrag != undefined) this.beforeDrag();

            this.realtimeUpdate(e);
        });
        document.addEventListener("mousemove", (e) => {
            if(this.dragging){
                if(this.whileDrag != undefined) this.whileDrag();

                this.realtimeUpdate(e);
            }
        });
        document.addEventListener("mouseup", (e) => {
            if(this.dragging){
                this.dragging = false;
                if(this.afterDrag != undefined) this.afterDrag();
                if(!this.realtime) this.updateValue(this.getNewValue(e));
            }
        });

        return slider;
    }
    realtimeUpdate(e){
        let newValue = this.getNewValue(e);
        if(this.realtime){
            this.updateValue(newValue);
        }else{
            let tempPercent = newValue / this.max;
            this.updateHandle(tempPercent);
        }
    }
    getNewValue(e){
        let handleSize = Slider.sliderHandleSize;

        // Has to be called everytime, because window can be resized
        this.sliderL = this.node.getBoundingClientRect().left + handleSize/2;
        this.sliderR = this.node.getBoundingClientRect().right - handleSize/2;

        // Get relative x position inside slider
        let max = this.sliderR - this.sliderL;
        let relX = e.pageX - this.sliderL;
        if(relX >= max){
            relX = max;
        }else if(relX <= 0){
            relX = 0;
        }

        let percentage = relX / this.realWidth;
        return percentage * this.max;
    }
    init(){ // For initial position of slider elements
        this.updateNodeValues();
        this.updateHandle(this.valuePercent);

        // Init all passive sliders
        this.passiveSliders.forEach(child => {
            child.update();
        })
    }
    updateNodeValues(){
        let sliderSize = parseInt(Utils.getComputedStyle(this.node, "width"));
        this.realWidth = sliderSize - Slider.sliderHandleSize;
    }
    updateHandle(percent){
        this.handle.style.left = (percent * this.realWidth) + "px";
        this.sliderBarMain.style.transform = `scaleX(${percent})`;
    }
    update(){
        if(!this.realtime && this.dragging) return;

        this.updateHandle(this.valuePercent);

        if(this.label != undefined){
            this.node.setAttribute("aria-label", (this.valuePercent * 100).toFixed(0) + "% " + this.label);
        }

    }
}

/** @class PassiveSlider @implements {Controls, Listener}
 *  @desc Minimal Slider Bar for @class Slider, only listening to an event
 */
class PassiveSlider{
    get valuePercent(){
        return this.valueFn() / this.max;
    }
    constructor(values, className = null){
        this.slider = new Container(className);
        this.node = this.slider.node;
        this.updateValue = values.updateValue;
        this.valueFn = values.valueFn;
        this.min = values.min;
        this.max = values.max;
    }
    update(){
        this.node.style.transform = `scaleX(${this.valuePercent})`;
    }
}

/** @class Container @implements {Controls}
 *  @desc Container for other Controls items
 *
 * @var {HTML5Element} node - DIV Element as Container Node
 * @var {String} innerHTML - Direct Access to @var node.innterHTML
 *
 * @constructor
 *  @param {?String} className - Init Container with class
 *
 * @function addClass - Add class to container
 *  @param {String} className
 *
 * @function append - Append child to container
 *  @param {Controls} child
 *
 * @function appendMultiple - Append array of children to container
 *  @param {Array[Controls]} children
 */
class Container {
    set innerHTML(text){
        this.node.innerHTML = text;
    }
    constructor(className = null){
        this.node = document.createElement("DIV");

        if(className != null)
            this.addClass(className);
    }
    addClass(className){
        this.node.classList.add(className);
    }
    append(child){
        this.node.appendChild(child.node);
    }
    appendMultiple(children){
        children.forEach((child) => {
            this.append(child);
        });
    }
}

class Utils{
    static normalizeTime(time){
        // Convert Time to Minutes and Seconds
        var hours = Math.floor(time / 3600);
        var minutes = Math.floor((time - hours * 3600) / 60);
        var seconds = Math.floor(time - (minutes * 60) - (hours * 3600));
        hours = prependTime(hours);
        minutes = prependTime(minutes);
        seconds = prependTime(seconds);
        var dateTime = ((hours != "00") ? hours + ":" : "") + minutes + ":" + seconds;

        return dateTime;
    }
    static logger(msg){
        if(MediaPlayer.debugging){
            console.log(msg);
        }
    }
    static isPointer(){
        var hovers = document.querySelector(":hover");
        if(hovers == null){
            this.logger("No Hover Element");
            return false;
        }

        var innerHover;
        while(hovers){
            innerHover = hovers;
            hovers = innerHover.querySelector(":hover");
        }

        var pointer = window.getComputedStyle(innerHover).cursor == "pointer";
        this.logger("Is Pointer: " + pointer);
        return pointer;
    }
    static getComputedStyle(elem, style){
        return window.getComputedStyle(elem, null).getPropertyValue(style);
    }
}

function MediaControls(video, prefix){
    // Progress Bar
    function createProgressBar(){
        var container = document.createElement("DIV");
        container.classList.add(identifiers.progressContainer, identifiers.progressHover);

        // Create Progress Bar Container
        var bar = document.createElement("DIV");
        bar.classList.add(identifiers.progressBar);

        // Create Time Label that displays on hover
        var timeLabel = document.createElement("DIV");
        timeLabel.classList.add(identifiers.previewTime);

        // Element for showing current Progress
        var currProgress = document.createElement("DIV");
        currProgress.classList.add(identifiers.currProgress);

        // Element for showing closest buffered range
        var currBuffered= document.createElement("DIV");
        currBuffered.classList.add(identifiers.currBuffer);

        var draggingTimeBar = false;
        var wasPlaying = false;

        // Show TimeStamp on hover at whole progress bar container
        container.addEventListener("mousemove", function(e){
            var offset = relativeMouseX(e, bar);
            showTimestamp(offset);
        });

        // Make current Progress Bar to follow mouse until mouse up
        container.addEventListener("mousedown", function(e){
            if(!video.paused){
                video.pause();
                wasPlaying = true;
            }
            draggingTimeBar = true;
            currProgress.style.transition = "transform 0s";
            timeLabel.style.display = "block";
            moveHandle(e);
        });
        document.addEventListener("mousemove", function(e){
            if(draggingTimeBar) moveHandle(e);
        });

        // Seeking to selected Time
        document.addEventListener("mouseup", function(e){
            if(draggingTimeBar){
                draggingTimeBar = false;
                timeLabel.style.display = "";
                currProgress.style.transition = "";
                seekVideo(e);

                if(wasPlaying){
                    video.play();
                    wasPlaying = false;
                }
            }
        });

        bar.appendChild(currBuffered);
        bar.appendChild(currProgress);
        container.appendChild(bar);
        container.appendChild(timeLabel);
        return container;

        // Move current Progress Bar
        function moveHandle(e){
            var offset = relativeMouseX(e, bar);
            showTimestamp(offset);

            var percentage = getPercentage(offset);
            currProgress.style.transform = "scaleX("+percentage+")";
        }
        // Seek to specified Time
        function seekVideo(e){
            var scale = currProgress.style.transform;
            var percentage = scale.substring(scale.indexOf("(")+1, scale.indexOf(")"));
            video.currentTime = percentage * video.duration;
        }
    }
    function showTimestamp(offset){
        // Show current Time on Label
        var percentage = getPercentage(offset);
        var time = video.duration * percentage;

        var label = progressBar.querySelector("." + identifiers.previewTime);
        label.innerHTML = normalizeTime(time);
        label.style.left = (offset-label.offsetWidth/2) + "px";
    }
    function getPercentage(offset){
        // Get Percentage of offset from whole progress bar
        var bar = progressBar.querySelector("." + identifiers.progressBar);
        var max = bar.getBoundingClientRect().right - bar.getBoundingClientRect().left;
        var percentage = offset / max;
        return percentage;
    }
    function relativeMouseX(e, bar){
        // Get relative mouse X coordinates to progress bar
        var progressBarL = bar.getBoundingClientRect().left;
        var progressBarR = bar.getBoundingClientRect().right;
        var mouseX = e.pageX;

        var max = progressBarR - progressBarL;
        var relX = mouseX - progressBarL;
        if(relX >= max){
            relX = max;
        }else if(relX <= 0){
            relX = 0;
        }

        return relX;
    }
    function getScaleByTime(time){
        // Get Percentage of current Time to Video Duration for scaling Progress Bars
        var percentage = time / video.duration;
        return percentage;
    }
    function getBufferRangeIndex(){
        // Get Index of closest Buffer Range to current Time
        var buffers = video.buffered;
        var index = 0;
        for(var i = 0; i < buffers.length; i++){
            var bufferEnd = buffers.end(i);
            var lastBuffer = buffers.end(index);
            if(bufferEnd > video.currentTime){
                if(lastBuffer <= video.currentTime || (lastBuffer > video.currentTime && bufferEnd < lastBuffer)){
                    index = i;
                }
            }
        }
        return index;
    }
    function updateCurrentBuffer(){
        // Update Buffer to show closest buffer time
        if(video.buffered.length > 0){
            var bufferId = getBufferRangeIndex();
            var currBuff = video.buffered.end(bufferId);
            var currBuffered = progressBar.querySelector("." + identifiers.currBuffer);
            currBuffered.style.transform = "scaleX("+getScaleByTime(currBuff)+")";
        }
    }
    function updateCurrentProgress(){
        // Scale current Progress Bar
        var currTime = video.currentTime;
        var currProgress = progressBar.querySelector("." + identifiers.currProgress);
        currProgress.style.transform = "scaleX("+getScaleByTime(currTime)+")";
    }


    // Quality Button
    function createQualityLabel(){
        var container = document.createElement("DIV");
        container.classList.add(identifiers.qualityLabel);
        container.appendChild(getQuality());

        return container;
    }
    function getQuality(){
        // Get height of video and display as Quality
        var text = document.createElement("DIV");
        text.innerHTML = video.videoHeight + "p";
        return text;
    }
    // Time Display
    function createTimeLabel(){
        var timeDisplay = document.createElement("DIV");
        timeDisplay.classList.add(identifiers.timeDisplay);

        // Element for showing current Time of Video
        var currTime = document.createElement("SPAN");
        currTime.innerHTML = getCurrentTime();
        currTime.classList.add(identifiers.timeCurr);

        // Element for showing duration of video
        var totalTime = document.createElement("SPAN");
        totalTime.innerHTML = getTotalTime();
        totalTime.classList.add(identifiers.timeTotal);

        var separator = getSeparator();

        timeDisplay.appendChild(currTime);
        timeDisplay.appendChild(separator);
        timeDisplay.appendChild(totalTime);
        return timeDisplay;
    }
    function getCurrentTime(){
        var time = video.currentTime;
        return normalizeTime(time);
    }
    function getTotalTime(){
        var time = video.duration;
        return normalizeTime(time);
    }
    function getSeparator(){
        // Create Separator between Current Time and Total Time
        var sep = document.createElement("SPAN");
        sep.innerHTML = " / ";
        return sep;
    }
    function prependTime(time){
        return (time < 10) ? "0" + time : time;
    }

    // Create UI Elements of Left Container
    /*var leftContainer = document.createElement("DIV");
    var playBtn = createPlayButton();
    var volBtn = createVolumeButton();
    var volSlide = createVolumeSlider();
    var timeLabel = createTimeLabel();
    var backBtn = createBackButton();
    var forwardBtn = createForwardButton();
    leftContainer.appendChild(backBtn);
    leftContainer.appendChild(playBtn);
    leftContainer.appendChild(forwardBtn);
    leftContainer.appendChild(volBtn);
    leftContainer.appendChild(volSlide);
    leftContainer.appendChild(timeLabel);
    leftContainer.classList.add(identifiers.leftContainer);

        // Create UI Elements of Right Container
        var rightContainer = document.createElement("DIV");
        var fullscreenBtn = createFullscreenButton();
        var playSpeedBtn = createPlaySpeedButton();
        var qualityLabel = createQualityLabel();
        rightContainer.appendChild(qualityLabel);
        rightContainer.appendChild(playSpeedBtn);
        rightContainer.appendChild(fullscreenBtn);
        rightContainer.classList.add(identifiers.rightContainer);

        // Create Progress Bar and Add elements to sub container
        var progressBar = createProgressBar();
        subContainer.appendChild(progressBar);
        subContainer.appendChild(leftContainer);
        subContainer.appendChild(rightContainer);

        // Update UI for first display
        updateVolumeButton();
        updateCurrentProgress();
        updateCurrentBuffer();

        // Add Listeners to Video and add Style
        addVideoListeners();

        /* PUBLIC FUNCTIONS */
        // Remove Controls and Listeners from original video source

    // Start Idler
        var idleInterval = startIdler();
        return container;

        // Video Listeners
        function addVideoListeners(){
            video.addEventListener("timeupdate", videoTimeListener);
            video.addEventListener("seeked", videoSeekListener);
            video.addEventListener("loadedmetadata", videoMetadataListener);
            video.addEventListener("ratechange", videoRateListener);
            video.addEventListener("progress", videoProgressListener);
            video.addEventListener("waiting", videoWaitListener);
            video.addEventListener("playing", videoPlayingListener);
            video.addEventListener("mouseleave", videoMouseLeaveListener);
            video.addEventListener("mousemove", videoMouseMoveListener);
            container.addEventListener("mousemove", videoMouseMoveListener);
            container.addEventListener("transitionend", controlsTransitionEndListener);
        }
        function videoPlayListener(){
            idleInterval = startIdler();
        }
        function videoPauseListener(){
            clearIdler();
            showControls(1);
        }

        function videoTimeListener(){
            // No Update on seeking and paused videos
            if(video.seeking || video.paused) return;

            // Update Time Display
            var currTimeLabel = timeLabel.querySelector("." + identifiers.timeCurr);
            var time = getCurrentTime();
            if(currTimeLabel.innerHTML != time){
                currTimeLabel.innerHTML = time;
            }

            // Update Progress Bar for current Time
            updateCurrentProgress();
        }
        function videoSeekListener(){
            // Update Time Display
            var currTimeLabel = timeLabel.querySelector("." + identifiers.timeCurr);
            var time = getCurrentTime();
            if(currTimeLabel.innerHTML != time){
                currTimeLabel.innerHTML = time;
            }

            // Update Progress Bar for current Time
            updateCurrentProgress();
        }
        function videoMetadataListener(){
            // When Metadata is now available, update TotalTime and Quality Label
            var tTotal = timeLabel.querySelector("." + identifiers.timeTotal);
            tTotal.innerHTML = getTotalTime();

            qualityLabel.removeChild(qualityLabel.firstChild);
            qualityLabel.appendChild(getQuality());
        }
        function videoFullscreenListener(){
            // Toggle Fullscreen
            if(document.webkitFullscreenElement == video){
                changeExitFull(fullscreenBtn);
            }else{
                changeFullscreen(fullscreenBtn);
            }
        }
        function videoRateListener(){
            updatePlayback();
        }
        function videoProgressListener(){
            updateCurrentBuffer();
        }
        function videoWaitListener(){
            displayLoading();
            logger("Video Waiting");
        }
        function videoPlayingListener(){
            logger("Video playable");
            updatePlayback();

            // Hide Loading Icon when playable
            var loading = container.querySelector("." + identifiers.loading);
            if(loading != null)
                loading.style.display = "none";
        }
        function videoMouseLeaveListener(e){
            // Hide Controls when Mouse leaves video area
            if(!video.paused && !insideBoundary(e)){
                showControls(0);
                clearIdler();
            }
            logger("Mouse Leaving");
        }
        function videoMouseMoveListener(){
            if(video.paused) return;

            // Show Controls and Start Idler if controls hidden
            if(!isControls()){
                showControls(1);
                idleInterval = startIdler();
            }

            resetIdler();
            logger("Mouse Moving.");
        }
        function controlsTransitionEndListener(){
            container.setAttribute("data-transition", "false");
        }

        function displayLoading(){
            // Create Loading Icon if not available and display
            var loading = container.querySelector("." + identifiers.loading);
            if(loading == null){
                loading = document.createElement("DIV");
                loading.classList.add(identifiers.loading);
                loading.innerHTML = "<svg class='circular' viewBox='25 25 50 50'><circle class='path' cx='50' cy='50' r='20' fill='none' stroke-width='3' stroke-miterlimit='10'/></svg>";
                loading.style.display = "none";
                container.appendChild(loading);
            }else if(loading.style.display == "none"){
                loading.style.display = "block";
            }
        }
        function showControls(status){
            // No hover for progress bar when hidden and prevent mouseEnter event during transition
            if(!status){
                container.setAttribute("data-transition", "true");
                progressBar.classList.remove(identifiers.progressHover);
                playSpeedBtn.querySelector("UL").style.display = "none";
            }else{
                progressBar.classList.add(identifiers.progressHover);
            }

            // Toggle Video Controls
            video.style.cursor = (status) ? "" : "none";
            container.style.cursor = (status) ? "" : "none";
            progressBar.style.cursor = (status) ? "" : "none";
            container.style.height = (status) ? "" : "0px";

            if(status){
                logger("Show Controls");
            }else{
                logger("Hide Controls");
            }
        }
        function isControls(){
            // Check if Controls are hidden or not
            return (container.style.height == "0px") ? false : true;
        }
        function insideBoundary(e){
            // Check if mouse is inside video boundaries
            var boundary = {
                L: video.getBoundingClientRect().left,
                R: video.getBoundingClientRect().right,
                T: video.getBoundingClientRect().top,
                B: video.getBoundingClientRect().bottom
            };
            var mouse = {X: e.pageX, Y: e.pageY};

            if(mouse.X > boundary.L && mouse.X < boundary.R && mouse.Y > boundary.T && mouse.Y < boundary.B){
                return true;
            }else{
                return false;
            }
        }
        function startIdler(){
            if(video.paused){
                clearIdler();
                return null;
            }

            if(idleInterval != null){
                clearIdler();
            }

            // Start Idler that hides controls after couple seconds
            logger("Start Idler");
            return setInterval(function(){
                if(isControls() && !isPointer()){
                    if(values.idler == 1){
                        showControls(0);
                        clearIdler();
                    }else{
                        values.idler++;
                    }
                }
            }, 1500);
        }
        function resetIdler(){
            // Reset Idler if mouse moving or show Controls if it is hidden
            if(values.idler != 0){
                values.idler = 0;
            }
            logger("Reset Idler");
        }
        function clearIdler(){
            clearInterval(idleInterval);
            idleInterval = null;
            logger("Stop Idler");
        }

    /*** Controls UI ***/

    // Playback Speed Button
    function createPlaySpeedButton(){
        var container = document.createElement("DIV");
        container.classList.add(identifiers.playSpeed);

        var currRate = document.createElement("SPAN");
        currRate.innerHTML = video.playbackRate + "x";
        container.appendChild(currRate);

        var playbackOptions = document.createElement("UL");
        for(var i = 0; i < values.playbackRates.length; i++){
            var option = document.createElement("LI");
            option.innerHTML = values.playbackRates[i];
            playbackOptions.appendChild(option);
        }
        container.appendChild(playbackOptions);

        // Show Playback Options on click
        currRate.addEventListener("click", function(){
            toggleDisplay(playbackOptions);
        });

        // Change Playback Rate and hide Options
        playbackOptions.addEventListener("click", function(e){
            var target = e.srcElement;
            video.playbackRate = target.innerHTML;
            toggleDisplay(playbackOptions);
        });

        return container;
    }
    function toggleDisplay(elem){
        var display = elem.style.display;
        elem.style.display = (display == "block") ? "none" : "block";
    }
    function updatePlayback(){
        // Update Playback Rate Label
        var rateText = playSpeedBtn.querySelector("SPAN");
        rateText.innerHTML = video.playbackRate + "x";
    }
}