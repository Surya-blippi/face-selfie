"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';

interface Analysis {
  skinTone: string;
  faceShape: string;
  recommendations: string[];
}

const SelfieAnalyzer = () => {
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Check browser compatibility
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support camera access');
      return;
    }

    // List available devices
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        addDebugMessage(`Found ${videoDevices.length} video devices`);
        console.log('Available video devices:', videoDevices);
      })
      .catch(err => {
        console.error('Error listing devices:', err);
        addDebugMessage('Error listing video devices');
      });

    return () => {
      if (videoRef.current?.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const addDebugMessage = (message: string) => {
    setDebug(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
    console.log(message);
  };

  const startCamera = async () => {
    addDebugMessage('Starting camera...');
    
    // Reset everything first
    resetAll();

    try {
      addDebugMessage('Requesting camera access...');
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      addDebugMessage('Camera access granted');
      
      if (!videoRef.current) {
        addDebugMessage('Video element not found!');
        return;
      }

      // Set up video element
      videoRef.current.srcObject = newStream;
      
      // Wait for metadata to load
      videoRef.current.onloadedmetadata = async () => {
        addDebugMessage('Video metadata loaded');
        try {
          await videoRef.current?.play();
          addDebugMessage('Video playing successfully');
          setStream(newStream);
          setIsCameraOpen(true);
          setError(null);
        } catch (playError) {
          addDebugMessage(`Error playing video: ${playError}`);
          throw playError;
        }
      };

      // Add error handler
      videoRef.current.onerror = (err) => {
        addDebugMessage(`Video element error: ${err}`);
        setError('Error with video playback');
      };

    } catch (error) {
      addDebugMessage(`Camera access error: ${error}`);
      console.error('Camera access error:', error);
      setError('Could not access camera. Please ensure permissions are granted and no other app is using the camera.');
      resetAll();
    }
  };

  const captureImage = () => {
    if (!videoRef.current) {
      setError('Video stream not available');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Flip the image horizontally if needed
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImage(dataUrl);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setStream(null);
      setIsCameraOpen(false);
      addDebugMessage('Image captured successfully');
    } catch (error) {
      console.error('Capture error:', error);
      setError('Failed to capture image. Please try again.');
      addDebugMessage('Error capturing image');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        addDebugMessage('File uploaded successfully');
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setAnalysis({
        skinTone: "Warm",
        faceShape: "Oval",
        recommendations: [
          "Your face shape suits side-parted hairstyles",
          "Gold jewelry would complement your warm skin tone",
          "Try warm-toned makeup colors"
        ]
      });
      addDebugMessage('Analysis completed');
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Unable to analyze image. Please try again.');
      addDebugMessage('Error during analysis');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current?.srcObject) {
      const oldStream = videoRef.current.srcObject as MediaStream;
      oldStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setImage(null);
    setAnalysis(null);
    setError(null);
    setIsCameraOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    addDebugMessage('Reset completed');
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6">Selfie Analysis</h2>
      
      {/* Debug Information */}
      <div className="mb-4 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
        <p className="font-bold">Debug Info:</p>
        {debug.map((msg, i) => (
          <p key={i} className="text-gray-600">{msg}</p>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {!image && !isCameraOpen && (
        <div className="space-y-4">
          <button 
            onClick={startCamera}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="h-4 w-4" />
            Take Selfie
          </button>
          <div className="text-center text-gray-500">or</div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
      )}

      {isCameraOpen && (
        <div className="space-y-4">
          <div className="relative w-full pt-[56.25%] bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ transform: 'scaleX(-1)' }}
              className="absolute top-0 left-0 w-full h-full object-cover"
            />
            <div className="absolute bottom-2 right-2 bg-white px-2 py-1 rounded text-xs">
              {stream ? 'Camera Active' : 'Starting Camera...'}
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                addDebugMessage('Manual camera check');
                if (videoRef.current) {
                  addDebugMessage(`Video ready state: ${videoRef.current.readyState}`);
                  addDebugMessage(`Video playing: ${!videoRef.current.paused}`);
                  addDebugMessage(`Video has source: ${!!videoRef.current.srcObject}`);
                }
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg"
            >
              Check Camera
            </button>
            <button 
              onClick={resetAll}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={captureImage}
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
              disabled={!stream}
            >
              Capture Photo
            </button>
          </div>
        </div>
      )}

      {image && !analysis && (
        <div className="space-y-4">
          <div className="w-full aspect-video relative rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={image}
              alt="Captured selfie"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={resetAll}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <button 
              onClick={analyzeImage}
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
              disabled={isProcessing}
            >
              {isProcessing ? 'Analyzing...' : 'Analyze Selfie'}
            </button>
          </div>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-1/3 aspect-video relative rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={image!}
                alt="Analyzed selfie"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Analysis Results:</h3>
              <p className="text-gray-600">Face Shape: <span className="text-gray-900">{analysis.faceShape}</span></p>
              <p className="text-gray-600">Skin Tone: <span className="text-gray-900">{analysis.skinTone}</span></p>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg mb-2">Recommendations:</h3>
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, index) => (
                <li 
                  key={index}
                  className="p-3 bg-gray-50 rounded-lg text-gray-700"
                >
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          <button 
            onClick={resetAll}
            className="w-full border border-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors mt-4"
          >
            Try Another Photo
          </button>
        </div>
      )}
    </div>
  );
};

export default SelfieAnalyzer;