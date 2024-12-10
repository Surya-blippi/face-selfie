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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Cleanup function for camera stream
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Debug function to list available cameras
  const listCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log('Available cameras:', cameras);
    } catch (error) {
      console.error('Error listing cameras:', error);
    }
  };

  useEffect(() => {
    listCameras();
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Your browser does not support camera access');
      return;
    }

    // Stop any existing streams
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      let mediaStream;
      
      try {
        // First try to get the front camera
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          }
        });
      } catch (frontCameraError) {
        // If front camera fails, try any available camera
        console.log('Front camera failed, trying any camera');
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve(true);
          }
        });

        await videoRef.current.play();
        setStream(mediaStream);
        setIsCameraOpen(true);
        setError(null);
        console.log('Camera started successfully');
      }
    } catch (error) {
      console.error('Camera start error:', error);
      setError('Unable to access camera. Please ensure you have granted camera permissions and are using a supported browser.');
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
      
      // Set canvas size to match video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw the current video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to JPEG with 0.8 quality
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImage(dataUrl);
      
      // Cleanup
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setStream(null);
      setIsCameraOpen(false);
    } catch (error) {
      console.error('Capture error:', error);
      setError('Failed to capture image. Please try again.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImage(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Simulated analysis results - replace with actual API call
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
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Unable to analyze image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setImage(null);
    setAnalysis(null);
    setError(null);
    setIsCameraOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6">Selfie Analysis</h2>
      
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
          <div className="relative w-full pt-[56.25%]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute top-0 left-0 w-full h-full rounded-lg bg-gray-100 object-cover"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={resetAll}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={captureImage}
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
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