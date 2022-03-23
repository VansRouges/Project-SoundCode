function __log(e, data) {
  console.log(e, data)
}

let audio_context;
let recorder;

function setStatus(statusText) {
  const status = document.getElementById('search-status')
  status.innerText = statusText;

}

function setCurrentSong({title, artist, link, score}) {
  const titleElement = document.getElementById('song-title')
  const artistElement = document.getElementById('song-artist')
  const linkElement = document.getElementById('song-link')
  const scoreElement = document.getElementById('match-score')

  titleElement.innerText = title;
  artistElement.innerText = artist ?? '_';
  linkElement.innerText = link ?? '_'
  linkElement.href = link ?? ''
  scoreElement.innerText =  score;

  toggleMatchedSongDisplay(true)
}


function toggleMatchedSongDisplay(show) {
  if (show) {
    document.getElementById('matched-song').classList.remove('d-none')
    document.getElementById('matched-song').classList.add('d-table')
  }else {
    document.getElementById('matched-song').classList.remove('d-table')
    document.getElementById('matched-song').classList.add('d-none')
  }
}


function startUserMedia(stream) {
  let input = audio_context.createMediaStreamSource(stream);
  __log('Media stream created.' );
  __log("input sample rate " +input.context.sampleRate);

  // Feedback!
  //input.connect(audio_context.destination);
  __log('Input connected to audio context destination.');

  recorder = new Recorder(input, {
    numChannels: 1
  });
  __log('Recorder initialised.');
}

function startRecording(button) {
  setStatus("Recording...")
  toggleMatchedSongDisplay(false)
  recorder && recorder.record();
  button.disabled = true;
  button.nextElementSibling.disabled = false;
  __log('Recording...');
}

function stopRecording(button) {
  recorder && recorder.stop();
  button.disabled = true;
  button.previousElementSibling.disabled = false;
  __log('Stopped recording.');

  // create WAV download link using audio data blob
  uploadFile();

  // recorder.clear();
}

function uploadFile() {
  setStatus("Sending to Server 🚀...")

  recorder && recorder.exportWAV(async function(file) {
    let data = new FormData();
    data.append('file', file)

    $.ajax({
      type: 'POST',
      url: 'https://soundedoc.herokuapp.com/recognition/identify',
      data: data,
      processData: false,
      contentType: false
    }).done(function(data) {

      const match = data.metadata?.custom_files?.[0];
      setStatus(match? "Got it! 🎉 Successfully located song" : "Couldn't find this one, please try again")

      if (match) {
        setCurrentSong({title: match.title, artist: match.artist, link: match.url})
      }

      console.log(match);

      console.log(data)
      recorder.clear();
    });
  });
}

window.onload = function init() {
  try {
    // webkit shim
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    navigator.getUserMedia = ( navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia);
    window.URL = window.URL || window.webkitURL;

    audio_context = new AudioContext;
    __log('Audio context set up.');
    __log('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
  } catch (e) {
    alert('No web audio support in this browser!');
  }

  navigator.getUserMedia({audio: true}, startUserMedia, function(e) {
    __log('No live audio input: ' + e);
  });
};
