import { Slider, PassiveSlider } from "./slider";
import { identifiers } from "../constants";

export class ProgressBar extends Slider {

    private wasPaused: boolean;
    bufferProgress: PassiveSlider;

    static get progressHeight(){ return 3; }
    static get progressContainer(){ return 16; }
    constructor(video: HTMLVideoElement){
        let values = {
            valueFn: () => video.currentTime,
            min: 0,
            max: video.duration,
            updateValue: (newValue) => video.currentTime = newValue,
        };
        super(values);

        this.setBeforeDrag(() => {
            this.wasPaused = video.paused;
            video.pause();
        });
        this.setAfterDrag(() => {
            if(!this.wasPaused)
                video.play();
        });
        this.setLabel("Video Progress");
        this.addClass(identifiers.progressSlider);
        this.setRealtime(false);
        this.setFullsize(true);

        this.bufferProgress = new PassiveSlider({
            valueFn: () => this.getCurrentBuffer(video),
            min: 0,
            max: video.duration,
        }, identifiers.sliderBarBuffer);
        this.sliderBars.append(this.bufferProgress);
        this.bufferProgress.update();
    }
    getCurrentBuffer(video: HTMLVideoElement){
        // Get Index of closest Buffer Range to current Time
        let buffers = video.buffered;
        let index = 0;
        for(let i = 0; i < buffers.length; i++){
            let bufferEnd = buffers.end(i);
            let lastBuffer = buffers.end(index);
            if(bufferEnd > video.currentTime){
                if(lastBuffer <= video.currentTime || (lastBuffer > video.currentTime && bufferEnd < lastBuffer)){
                    index = i;
                }
            }
        }

        // Return Buffer Time
        return video.buffered.end(index);
    }
}