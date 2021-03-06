(function(window){

  let WORKER_PATH = 'scripts/record/recorderWorker.js';
  let encoderWorker = new Worker('scripts/record/mp3Worker.js');

  let Recorder = function rec(source, cfg){
    let config = cfg || {};
    let bufferLen = config.bufferLen || 4096;
    let numChannels = config.numChannels || 2;
    this.context = source.context;
    this.node = (this.context.createScriptProcessor ||
      this.context.createJavaScriptNode).call(this.context,
      bufferLen, numChannels, numChannels);
    let worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate,
        numChannels: numChannels
      }
    });
    let recording = false,
      currCallback;

    this.node.onaudioprocess = function(e){
      if (!recording) return;
      let buffer = [];
      for (let channel = 0; channel < numChannels; channel++){
        buffer.push(e.inputBuffer.getChannelData(channel));
      }
      worker.postMessage({
        command: 'record',
        buffer: buffer
      });
    }

    this.configure = function(cfg){
      for (let prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }

    this.record = function(){
      recording = true;
    }

    this.stop = function(){
      recording = false;
    }

    this.clear = function(){
      worker.postMessage({ command: 'clear' });
    }

    this.getBuffer = function(cb) {
      currCallback = cb || config.callback;
      worker.postMessage({ command: 'getBuffer' })
    }

    this.exportWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportWAV',
        type: type
      });
    }

    //Mp3 conversion
    worker.onmessage = function(e){
      let blob = e.data;
      //console.log("the blob " +  blob + " " + blob.size + " " + blob.type);

      let arrayBuffer;
      let fileReader = new FileReader();

      fileReader.onload = function(){
        arrayBuffer = this.result;
        let buffer = new Uint8Array(arrayBuffer),
          data = parseWav(buffer);

        console.log(data);
        console.log("Converting to Mp3");

        encoderWorker.postMessage({ cmd: 'init', config:{
            mode : 3,
            channels:1,
            samplerate: data.sampleRate,
            bitrate: data.bitsPerSample
          }});

        encoderWorker.postMessage({ cmd: 'encode', buf: Uint8ArrayToFloat32Array(data.samples) });
        encoderWorker.postMessage({ cmd: 'finish'});
        encoderWorker.onmessage = function(e) {
          if (e.data.cmd == 'data') {

            console.log("Done converting to Mp3");

            /*let audio = new Audio();
            audio.src = 'data:audio/mp3;base64,'+encode64(e.data.buf);
            audio.play();*/

            //console.log ("The Mp3 data " + e.data.buf);

            let mp3Blob = new Blob([new Uint8Array(e.data.buf)], {type: 'audio/mp3'});
            // uploadAudio(mp3Blob);
            //
            // let url = 'data:audio/mp3;base64,'+encode64(e.data.buf);
            // let li = document.createElement('li');
            // let au = document.createElement('audio');
            // let hf = document.createElement('a');
            //
            // au.controls = true;
            // au.src = url;
            // hf.href = url;
            // hf.download = 'audio_recording_' + new Date().getTime() + '.mp3';
            // hf.innerHTML = hf.download;
            // li.appendChild(au);
            // li.appendChild(hf);
            // recordingslist.appendChild(li);

          }
        };
      };

      fileReader.readAsArrayBuffer(blob);

      currCallback(blob);
    }


    // function encode64(buffer) {
    //   let binary = '',
    //     bytes = new Uint8Array( buffer ),
    //     len = bytes.byteLength;
    //
    //   for (let i = 0; i < len; i++) {
    //     binary += String.fromCharCode( bytes[ i ] );
    //   }
    //   return window.btoa( binary );
    // }

    function parseWav(wav) {
      function readInt(i, bytes) {
        let ret = 0,
          shft = 0;

        while (bytes) {
          ret += wav[i] << shft;
          shft += 8;
          i++;
          bytes--;
        }
        return ret;
      }
      if (readInt(20, 2) != 1) throw 'Invalid compression code, not PCM';
      if (readInt(22, 2) != 1) throw 'Invalid number of channels, not 1';
      return {
        sampleRate: readInt(24, 4),
        bitsPerSample: readInt(34, 2),
        samples: wav.subarray(44)
      };
    }

    function Uint8ArrayToFloat32Array(u8a){
      let f32Buffer = new Float32Array(u8a.length);
      for (let i = 0; i < u8a.length; i++) {
        let value = u8a[i<<1] + (u8a[(i<<1)+1]<<8);
        if (value >= 0x8000) value |= ~0x7FFF;
        f32Buffer[i] = value / 0x8000;
      }
      return f32Buffer;
    }

    function uploadAudio(mp3Data){
      let reader = new FileReader();
      reader.onload = function(event){
        let fd = new FormData();
        let mp3Name = encodeURIComponent('file' + new Date().getTime() + '.mp3');
        console.log("mp3name = " + mp3Name);
        // fd.append('fname', mp3Name);
        fd.append('file', mp3Data);
        $.ajax({
          type: 'POST',
          url: 'https://soundedoc.herokuapp.com/recognition/identify',
          data: fd,
          processData: false,
          contentType: false
        }).done(function(data) {
          console.log(data);
        });
      };
      reader.readAsDataURL(mp3Data);
    }

    source.connect(this.node);
    this.node.connect(this.context.destination);    //this should not be necessary
  };

  /*Recorder.forceDownload = function(blob, filename){
	console.log("Force download");
    let url = (window.URL || window.webkitURL).createObjectURL(blob);
    let link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'output.wav';
    let click = document.createEvent("Event");
    click.initEvent("click", true, true);
    link.dispatchEvent(click);
  }*/

  window.Recorder = Recorder;

})(window);
