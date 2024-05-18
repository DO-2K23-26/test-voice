import { useEffect, useRef, useState } from "react";
import "./App.css";
import { VideoPlayer } from "./component/VideoPlayer.tsx";

export type element = {
  id: string;
  width: number;
  controls: boolean;
  autoplay: boolean;
  srcObject: MediaStream;
};

interface PayloadSdp {
  type: "offer" | "answer";
  sdp: string;
}

type PayloadOfferCallback = (value: string | PromiseLike<string>) => void;
type PayloadAnswerCallback = (value: PayloadSdp) => void;

const endpointId = Math.floor(Math.random() * 1000000000);

function App() {
  const endpoint = import.meta.env.VITE_API_ENDPOINT;
  const pc = useRef(new RTCPeerConnection());
  const offerChannel = useRef(
    new RTCPeerConnection().createDataChannel("caca")
  );
  const [session, setSession] = useState(102314233);
  const streamCam = useRef(new MediaStream());
  const streamMic = useRef(new MediaStream());
  const medias = useRef(new Array<element>());
  const callbackRef = useRef<PayloadOfferCallback | PayloadAnswerCallback>(
    (value: PayloadSdp) => {
      console.log(value);
    }
  );

  const [sessionDisabled, setSessionDisabled] = useState(false);
  const [joinDisabled, setJoinDisabled] = useState(false);
  const [leaveDisabled, setLeaveDisabled] = useState(true);
  const [camDisabled, setCamDisabled] = useState(true);
  const [micDisabled, setMicDisabled] = useState(true);
  const [iceStatus, setIceStatus] = useState("Waiting");
  const [chanStatus, setChanStatus] = useState("Click Join Button...");
  const [media, setMedia] = useState(new Array<element>());

  useEffect(() => {
    console.log(medias.current);
    setMedia(medias.current);
  }, [medias.current.length]);

  const messageCallback = (event: MessageEvent) => {
    const json = JSON.parse(event.data);
    if (json.type == "offer") {
      // no callback probably means it's an offer
      handleOffer(event.data);
    } else if (json.type == "answer") {
      callbackRef.current(event.data);
      callbackRef.current = (value: PayloadSdp) => {
        console.log(value);
      };
    }
  };

  const onIceConnectionStateChangeCallback = () => {
    setIceStatus(pc.current.iceConnectionState);
    if (
      pc.current.iceConnectionState == "disconnected" ||
      pc.current.iceConnectionState == "failed"
    ) {
      console.log("state changed:", pc.current.iceConnectionState);
      if (streamCam.current) {
        streamCam.current.getTracks()[0]?.stop();
      }
      if (streamMic.current) {
        streamMic.current.getTracks()[0]?.stop();
      }
      pc.current.close();
      setJoinDisabled(true);
      setLeaveDisabled(true);
      setCamDisabled(true);
      setMicDisabled(true);
    }
  };

  const onOpenCallback = () => {
    setChanStatus("Joined session " + session + " as endpoint " + endpointId);
    setMicDisabled(false);
    setCamDisabled(false);
    setLeaveDisabled(false);
    console.log("onOpenCallback", onOpenCallback);
  };

  const onTrackCallback = (e: RTCTrackEvent) => {
    // console.log('ontrack', e.track);
    // const element: element = {
    //   id: '',
    //   width: 0,
    //   controls: false,
    //   autoplay: false,
    //   srcObject: new MediaStream(),
    // }
    // const track = e.track
    // element.id = track.id
    // // if (byId(domId)) {
    // //   // we aleady have this track
    // //   return;
    // // }
    // element.width = 500
    // element.controls = true
    // element.autoplay = true
    // setTimeout(() => {
    //   const new_media = new MediaStream();
    //   new_media.addTrack(track);
    //   element.srcObject = new_media
    // }, 1);
    // // if (!medias.current.find((value)=>value.id === element.id)){
    // //   console.log("ADD MEDIA", element.id)
    // //   medias.current.push(element)
    // //   setMedia(medias.current)
    // // }
    // track.addEventListener('mute', () => {
    //   console.log('track muted', element);
    //   medias.current = medias.current.filter((value)=>value.id === element.id)
    //   setMedia(medias.current)
    // })
    // track.addEventListener('unmute', () => {
    //   console.log('track unmuted', element);
    //   medias.current.push(element)
    //   setMedia(medias.current)
    // });
    console.log("ontrack", e.track);
    const track = e.track;
    const domId = `media-${track.id}`;
    const el = document.createElement("video");
    if (document.getElementById(domId)) {
      // we aleady have this track
      return;
    }
    el.id = domId;
    el.width = 500;
    document.getElementById("media")!.appendChild(el);
    el.controls = true;
    el.autoplay = true;
    setTimeout(() => {
      const media = new MediaStream();
      media.addTrack(track);
      el.srcObject = media;
    }, 1);
    track.addEventListener("mute", () => {
      console.log("track muted", track);
      el.parentNode!.removeChild(el);
    });
    track.addEventListener("unmute", () => {
      console.log("track unmuted", track);
      document.getElementById("media")!.appendChild(el);
    });
  };

  async function negotiate() {
    pc.current.createOffer().then(async (offer) => {
      console.log("do offer", JSON.stringify(offer));
      await pc.current.setLocalDescription(offer);
      offerChannel.current.send(JSON.stringify(offer));
      const json = (await new Promise((rs) => {
        callbackRef.current = rs;
      })) as string;
      const answer = JSON.parse(json);
      console.log("received answer", answer.sdp.split("\r\n"));
      try {
        await pc.current.setRemoteDescription(answer);
      } catch (error) {
        console.log("rtc.setRemoteDescription(answer) with error: ", error);
      }
    });
  }

  async function handleOffer(json: string) {
    const offer = JSON.parse(json);
    console.log("handle offer", offer.sdp.split("\r\n"));
    try {
      await pc.current.setRemoteDescription(offer);
    } catch (error) {
      console.log("rtc.setRemoteDescription(offer) with error: ", error);
    }
    const answer = await pc.current.createAnswer();
    console.log("offer response", JSON.stringify(answer));
    await pc.current.setLocalDescription(answer);
    offerChannel.current.send(JSON.stringify(answer));
  }

  async function startCam() {
    console.log("startCam");
    setCamDisabled(true);
    streamCam.current = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 640,
        height: 360,
      },
    });
    // medias.current.push({id: streamCam.current.id, width: 640, controls: true, autoplay: true, srcObject: streamCam.current });
    pc.current.addTransceiver(streamCam.current.getTracks()[0], {
      direction: "sendonly",
      streams: [streamCam.current],
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
    setMicDisabled(true);
    streamMic.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    pc.current.addTransceiver(streamMic.current.getTracks()[0], {
      streams: [streamMic.current],
      direction: "sendonly",
    });
    await negotiate();
  }

  function startRtc() {
    const path = endpoint + "/offer/" + session + "/" + endpointId;
    pc.current = new RTCPeerConnection({
      iceServers: [],
    });
    pc.current.oniceconnectionstatechange = onIceConnectionStateChangeCallback;
    pc.current.ontrack = onTrackCallback;
    pc.current.onsignalingstatechange = () => {
      console.log(pc.current.signalingState);
    };
    offerChannel.current = pc.current.createDataChannel("offer/answer");
    offerChannel.current.onmessage = messageCallback;
    offerChannel.current.onopen = onOpenCallback;

    pc.current.createOffer().then(async (offer) => {
      await pc.current.setLocalDescription(offer);

      // Send the offer to the server
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-type": "application/json",
        },
        body: JSON.stringify(offer),
      });

      const answer = await response.json();

      if (answer.sdp) {
        await pc.current.setRemoteDescription(answer);
      }
    });
  }

  async function leaveRtc() {
    setIceStatus("Waiting");
    setChanStatus("Click Join Button...");
    setSessionDisabled(false);
    setJoinDisabled(false);
    setLeaveDisabled(true);
    pc.current.close();

    const path = endpoint + "/leave/" + session + "/" + endpointId;
    await fetch(path, {
      method: "POST",
      mode: "cors",
    });
    const element = document.getElementById("media")!;
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  return (
    <>
      <label>
        Session:
        <input
          type="number"
          id="session"
          disabled={sessionDisabled}
          value={session}
          onInput={(event) => {
            setSession(event.currentTarget.valueAsNumber);
          }}
        ></input>
      </label>
      <button id="join" onClick={startRtc} disabled={joinDisabled}>
        Join
      </button>
      <button id="leave" onClick={leaveRtc} disabled={leaveDisabled}>
        Leave
      </button>
      <button id="cam" onClick={startCam} disabled={camDisabled}>
        Cam
      </button>
      <button id="mic" onClick={startMic} disabled={micDisabled}>
        Mic
      </button>
      Status: <span id="ice_status">{iceStatus}</span>
      <div id="chan_status">{chanStatus}</div>
      <div id="media">
        {media.map((value, index) => {
          console.log("la video", value.srcObject);
          return <VideoPlayer key={index} props={value} />;
        })}
      </div>
    </>
  );
}

export default App;
