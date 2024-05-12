import { SetStateAction, useState} from 'react'
import './App.css'

function App() {
  const [sessionDisabled, setSessionDisabled] = useState(false)
  const [joinDisabled, setJoinDisabled] = useState(false)
  const [leaveDisabled, setLeaveDisabled] = useState(true)
  const [camDisabled, setCamDisabled] = useState(true)
  const [micDisabled, setMicDisabled] = useState(true)
  const [iceStatus, setIceStatus] = useState('Waiting')
  const [chanStatus, setChanStatus] = useState('Click Join Button...')
  //TODO implement media from this state instead of byId which is not working for now
  const [media, setMedia] = useState([])
  const [session, setSession] = useState(Math.floor(Math.random() * 1000000000))
  // const [callback, setCallback] = useState(() => {})
  const [rtc, setRtc] = useState(new RTCPeerConnection())

  const endpoint = "https://172.22.0.1:8080"
  const byId = (id) => document.getElementById(id);
  const byTag = (tag) => [].slice.call(document.getElementsByTagName(tag));
  let callback = null;

  //TODO impplement all off this variable in states
  const endpointId = Math.floor(Math.random() * 1000000000);
  let streamCam: MediaStream;
  let streamMic: MediaStream;
  const [dataChannel, setDataChannel] = useState(new RTCPeerConnection().createDataChannel("offer/answer"))
  rtc.oniceconnectionstatechange = () => {
    setIceStatus(rtc.iceConnectionState)
    if (rtc.iceConnectionState == 'disconnected' || rtc.iceConnectionState == 'failed') {
      if (streamCam) {
        streamCam.getTracks()[0]?.stop();
      }
      if (streamMic) {
        streamMic.getTracks()[0]?.stop();
      }
      rtc.close();
      setJoinDisabled(true)
      setLeaveDisabled(true)
      setCamDisabled(true)
      setMicDisabled(true)
    }
  };

  async function negotiate() {
    const offer = await rtc.createOffer();
    console.log('do offer', offer.sdp.split('\r\n'));
    await rtc.setLocalDescription(offer);
    dataChannel.send(JSON.stringify(offer));
    const json = await new Promise((rs) => {
      callback = rs;
      console.log('callback', callback);
    });
    console.log('received answer', json);
    const answer = JSON.parse(json);
    console.log('received answer', answer.sdp.split('\r\n'));
    try {
      await rtc.setRemoteDescription(answer);
    } catch (error) {
      console.log('rtc.setRemoteDescription(answer) with error: ', error);
    }
  }

  async function handleOffer(json) {
    const offer = JSON.parse(json);
    console.log('handle offer', offer.sdp.split('\r\n'));
    try {
      await rtc.setRemoteDescription(offer);
    } catch (error) {
      console.log('rtc.setRemoteDescription(offer) with error: ', error);
    }
    const answer = await rtc.createAnswer();
    console.log('offer response', answer.sdp.split('\r\n'));
    await rtc.setLocalDescription(answer);
    dataChannel.send(JSON.stringify(answer));
  }

  async function startCam() {
    console.log('startCam')
    setCamDisabled(true)
    streamCam = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 640,
        height: 360,
      },
    });
    const tr = rtc.addTransceiver(streamCam.getTracks()[0], {
      direction: "sendonly",
      streams: [streamCam],
      // This table shows the valid values for simulcast.
      //
      // https://chromium.googlesource.com/external/webrtc/+/branch-heads/49/talk/media/webrtc/simulcast.cc
      // These tables describe from which resolution we can use how many
      // simulcast layers at what bitrates (maximum, target, and minimum).
      // Important!! Keep this table from high resolution to low resolution.
      // const SimulcastFormat kSimulcastFormats[] = {
      //   {1920, 1080, 3, 5000, 4000, 800},
      //   {1280, 720, 3,  2500, 2500, 600},
      //   {960, 540, 3, 900, 900, 450},
      //   {640, 360, 2, 700, 500, 150},
      //   {480, 270, 2, 450, 350, 150},
      //   {320, 180, 1, 200, 150, 30},
      //   {0, 0, 1, 200, 150, 30}
      // };

      // Uncomment this to enable simulcast. The actual selected
      // simulcast level is hardcoded in sync_chat.
      // sendEncodings: [
      //     { rid: "h", maxBitrate: 700 * 1024 },
      //     { rid: "l", maxBitrate: 150 * 1024 }
      // ]
    });
    await negotiate();
  }

  async function startMic() {
    setMicDisabled(true)
    console.log(dataChannel)
    streamMic = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    const tr = rtc.addTransceiver(streamMic.getTracks()[0], {
      streams: [streamMic],
      direction: "sendonly"
    });
    await negotiate();
  }

  rtc.ontrack = (e) => {
    console.log('ontrack', e.track);
    const track = e.track;
    const domId = `media-${track.id}`;
    const el = document.createElement('video');
    if (byId(domId)) {
      // we aleady have this track
      return;
    }
    el.id = domId;
    el.width = 500;
    byId('media').appendChild(el);
    el.controls = true;
    el.autoplay = true;
    setTimeout(() => {
      const media = new MediaStream();
      media.addTrack(track);
      el.srcObject = media;
    }, 1);
    track.addEventListener('mute', () => {
      console.log('track muted', track);
      el.parentNode.removeChild(el);
    });
    track.addEventListener('unmute', () => {
      console.log('track unmuted', track);
      byId('media').appendChild(el);
    });
  };

  async function startRtc() {
    const path = endpoint + '/offer/' + session + '/' + endpointId;
    setIceStatus('Connecting')
    setChanStatus('Joining session ' + session + ' as endpoint ' + endpointId)
    setSessionDisabled(true)
    setJoinDisabled(true)
    setLeaveDisabled(false)
    console.log('dataChannel');
    const channel = rtc.createDataChannel("offer/answer");
    channel.onmessage = (event) => {
      console.log('onmessage', event.data)
      const json = JSON.parse(event.data);
      if (json.type == 'offer') {
        // no callback probably means it's an offer
        handleOffer(event.data);
      } else if (json.type == 'answer') {
        console.log('answer', callback);
        callback(event.data);
        callback = null;
      }
    };
    channel.onopen = () => {
      setChanStatus('Joined session ' + session + ' as endpoint ' + endpointId)
      setMicDisabled(false)
      setCamDisabled(false)
    };
    setDataChannel(channel);
    const offer = await rtc.createOffer();
    await rtc.setLocalDescription(offer);
    console.log('POST offer', offer.sdp.split('\r\n'));

    const res = await fetch(path, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(offer),
    });
    console.log('POST offer response', res)
    const answer = await res.json();
    await rtc.setRemoteDescription(answer);
    console.log('POST answer', answer.sdp.split('\r\n'));
  }

  async function leaveRtc() {
    setIceStatus('Waiting')
    setChanStatus('Click Join Button...')
    setSessionDisabled(false)
    setJoinDisabled(false)
    setLeaveDisabled(true)
    rtc.close();

    const path = endpoint + '/leave/' + session + '/' + endpointId;
    const res = await fetch(path, {
      method: 'POST',
      mode: 'cors',
    });

    setRtc(new RTCPeerConnection())
  }

  return (
    <>
      <label >Session:
        <input type="number" id="session" disabled={sessionDisabled} value={session} onInput={(event) => {
          setSession(event.currentTarget.valueAsNumber)
        }}></input>
      </label>
      <button id="join" onClick={() => {startRtc()}} disabled={joinDisabled}>Join</button>
      <button id="leave" onClick={() => {leaveRtc()}} disabled={leaveDisabled}>Leave</button>
      <button id="cam" onClick={() => {startCam()}} disabled={camDisabled}>Cam</button>
      <button id="mic" onClick={() => {startMic()}} disabled={micDisabled}>Mic</button>
      Status: <span id="ice_status">{iceStatus}</span>
      <div id="chan_status">{chanStatus}</div>
      <div id="media">
        {/*{media.map((m) => {*/}
        {/*  return <video key={m.id} id={'media-' + m.id} width="500" controls autoPlay></video>*/}
        {/*})}*/}
      </div>
    </>
  )
}

export default App
