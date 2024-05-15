import {SetStateAction, useCallback, useEffect, useRef, useState} from 'react'
import './App.css'
import {Simulate} from "react-dom/test-utils";
import waiting = Simulate.waiting;

type element = {id: string, width: number, controls: boolean, autoplay: boolean, srcObject: MediaStream}


function App() {
  const [sessionDisabled, setSessionDisabled] = useState(false)
  const [joinDisabled, setJoinDisabled] = useState(false)
  const [leaveDisabled, setLeaveDisabled] = useState(true)
  const [camDisabled, setCamDisabled] = useState(true)
  const [micDisabled, setMicDisabled] = useState(true)
  const [iceStatus, setIceStatus] = useState('Waiting')
  const [chanStatus, setChanStatus] = useState('Click Join Button...')
  const [media, setMedia] = useState(new Array<element>())
  const [session, setSession] = useState(Math.floor(Math.random() * 1000000000))
  const [callback, setCallback] = useState( () => (value) => {})
  const [rtc, setRtc] = useState(new RTCPeerConnection())
  const [dataChannel, setDataChannel] = useState(new RTCPeerConnection().createDataChannel("caca"))
  const dataChannelRef = useRef(dataChannel)
  const rtcRef = useRef(rtc)
  const messageCallback = useCallback((event: MessageEvent) => {
    console.log('onmessage', event.data)
    const json = JSON.parse(event.data);
    if (json.type == 'offer') {
      // no callback probably means it's an offer
      handleOffer(event.data);
    } else if (json.type == 'answer') {
      setCallback(() => callback(event.data))
      console.log('answer', callback);
      callback(event.data);
    }
  }, [callback, dataChannel])

  const onIceConnectionStateChangeCallback = useCallback(() => {
    setIceStatus(rtcRef.current.iceConnectionState)
    if (rtcRef.current.iceConnectionState == 'disconnected' || rtcRef.current.iceConnectionState == 'failed') {
      if (streamCam) {
        streamCam.getTracks()[0]?.stop();
      }
      if (streamMic) {
        streamMic.getTracks()[0]?.stop();
      }
      rtcRef.current.close();
      setJoinDisabled(true)
      setLeaveDisabled(true)
      setCamDisabled(true)
      setMicDisabled(true)
    }
  }, [setIceStatus, rtc, setJoinDisabled, setLeaveDisabled, setCamDisabled, setMicDisabled, rtcRef])

  const onOpenCallback = useCallback(() => {
    setChanStatus('Joined session ' + session + ' as endpoint ' + endpointId)
    setMicDisabled(false)
    setCamDisabled(false)
    console.log('onOpenCallback', onOpenCallback)
  }, [setChanStatus, setMicDisabled, setMicDisabled])

  const onTrackCallback = useCallback((e) => {
    console.log('ontrack', e.track);
    const element: element = {
      id: '',
      width: 0,
      controls: false,
      autoplay: false,
      srcObject: new MediaStream(),
    }
    const track = e.track
    element.id = track.id
    // if (byId(domId)) {
    //   // we aleady have this track
    //   return;
    // }
    element.width = 500
    element.controls = true
    element.autoplay = true
    setTimeout(() => {
      const new_media = new MediaStream();
      new_media.addTrack(track);
      element.srcObject = new_media
    }, 1);
    if (!media.find((value)=>value.id === element.id)){
      console.log("ADD MEDIA", element.id)
      media.push(element)
    }
    setMedia(media)
    track.addEventListener('mute', () => {
      console.log('track muted', track);
      setMedia(media.filter((value)=>value.id === element.id))
    });
    track.addEventListener('unmute', () => {
      console.log('track unmuted', track);
      if (!media.find((value)=>value.id === element.id)){
        console.log("ADD MEDIA", element.id)
        media.push(element)
      } else {
        setMedia(media.filter((value)=>value.id === element.id))
      }
      setMedia(media)
    });
  }, [media, setMedia])
  const endpoint = "https://172.22.0.1:8080"

  //TODO impplement all off this variable in states
  const endpointId = Math.floor(Math.random() * 1000000000);
  let streamCam: MediaStream;
  let streamMic: MediaStream;
  rtc.oniceconnectionstatechange = onIceConnectionStateChangeCallback

  rtc.ontrack = onTrackCallback

  useEffect(() => {
    rtcRef.current = rtc;
    console.log("RTC :", rtc)
  } ,[rtc])

  useEffect(() => {
    dataChannelRef.current = dataChannel;
    console.log("DATACHANNEL CHANGE :", dataChannel)
  } ,[dataChannel])

  useEffect(() => {
    for (const element of media){
      document.getElementById(element.id).srcObject = element.srcObject
    }
  }, [media])

  async function negotiate() {
    const offer = await rtcRef.current.createOffer();
    console.log('do offer', offer.sdp.split('\r\n'));
    await rtc.setLocalDescription(offer);
    rtcRef.current = rtc
    dataChannel.send(JSON.stringify(offer));
    const json = await new Promise((rs) => {
      setCallback(() => rs)
      console.log('callback', callback);
    });
    console.log('received answer', json);
    const answer = JSON.parse(json);
    console.log('received answer', answer.sdp.split('\r\n'));
    try {
      await rtc.setRemoteDescription(answer);
      rtcRef.current = rtc;
    } catch (error) {
      console.log('rtc.setRemoteDescription(answer) with error: ', error);
    }
  }

  async function handleOffer(json) {
    const offer = JSON.parse(json);
    console.log('handle offer', offer.sdp.split('\r\n'));
    try {
      await rtc.setRemoteDescription(offer);
      rtcRef.current = rtc;
    } catch (error) {
      console.log('rtc.setRemoteDescription(offer) with error: ', error);
    }
    const answer = await rtc.createAnswer();
    console.log('offer response', answer.sdp.split('\r\n'));
    await rtc.setLocalDescription(answer);
    rtcRef.current = rtc;
    dataChannelRef.current.send(JSON.stringify(answer));
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
    rtc.addTransceiver(streamCam.getTracks()[0], {
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
    rtcRef.current = rtc;
    await negotiate();
  }

  async function startMic() {
    setMicDisabled(true)
    streamMic = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    rtc.addTransceiver(streamMic.getTracks()[0], {
      streams: [streamMic],
      direction: "sendonly"
    });
    rtcRef.current = rtc;
    await negotiate();
  }

  async function startRtc() {
    const path = endpoint + '/offer/' + session + '/' + endpointId;
    setIceStatus('Connecting')
    setChanStatus('Joining session ' + session + ' as endpoint ' + endpointId)
    setSessionDisabled(true)
    setJoinDisabled(true)
    setLeaveDisabled(false)
    const channel = rtc.createDataChannel("offer/answer")
    channel.onmessage = messageCallback
    channel.onopen = onOpenCallback
    setDataChannel(channel)
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
    rtcRef.current= rtc
    setRtc(rtc)
    console.log('RTC JOIN:', rtc)
    console.log('POST answer', answer.sdp.split('\r\n'));
    console.log("FINAL CHANNEL:", dataChannelRef);
  }

  async function leaveRtc() {
    setIceStatus('Waiting')
    setChanStatus('Click Join Button...')
    setSessionDisabled(false)
    setJoinDisabled(false)
    setLeaveDisabled(true)
    rtc.close();

    const path = endpoint + '/leave/' + session + '/' + endpointId;
    await fetch(path, {
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
      <button id="join" onClick={startRtc} disabled={joinDisabled}>Join</button>
      <button id="leave" onClick={leaveRtc} disabled={leaveDisabled}>Leave</button>
      <button id="cam" onClick={startCam} disabled={camDisabled}>Cam</button>
      <button id="mic" onClick={startMic} disabled={micDisabled}>Mic</button>
      Status: <span id="ice_status">{iceStatus}</span>
      <div id="chan_status">{chanStatus}</div>
      <div id="media">
        {media.map((value,index) => {
          console.log("la video",value.srcObject)
          return <video key={index} id={value.id} src={value.srcObject} autoPlay={value.autoplay} controls={value.controls} />
        })}
      </div>
    </>
  )
}

export default App
