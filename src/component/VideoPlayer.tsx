import React, { useEffect, useRef } from "react";
import {element} from "../App.tsx";

export const VideoPlayer: React.FC<{ props: element }> = ({ props }) => {
    const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));

    useEffect(() => {
        console.log('videoooooo',videoRef.current && props.srcObject);
        videoRef.current.srcObject = props.srcObject;
    }, [props.srcObject]);
    return (
        <video
            id={props.id}
            style={{ width: props.width }}
            ref={videoRef}
            autoPlay={props.autoplay}
            controls={props.controls}
        />
    );
};
