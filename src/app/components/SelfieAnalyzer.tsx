"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { FaceAnalysisService } from '@/services/faceAnalysis';

interface Analysis {
  faceShape: string;
  skinTone: string;
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

  const addDebugMessage = (message: string) => {
    setDebug(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
    console.log(message);
  };

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support camera access');
      return;
    }

    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        addDebugMessage(`Found ${videoDevices.length} video devices`);
      })
      .catch(err => {
        addDebugMessage(`Error listing devices: ${err}`);
      });
  }, []);

  useEffect(() => {
    let mounted = true;
    const videoElement = videoRef.current;

    const initializeCamera = async () => {
      if (!isCameraOpen || !videoElement) return;

      try {
        if (videoElement.srcObject) {
          const oldStream = videoElement.srcObject as MediaStream;
          oldStream.getTracks().forEach(track => track.stop());
          videoElement.srcObject = null;
        }

        addDebugMessage('Initializing camera...');
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (!mounted) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }

        videoElement.srcObject = newStream;
        
        await new Promise((resolve) => {
          if (!videoElement) return;
          videoElement.onloadedmetadata = resolve;
        });

        if (!mounted) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }

        await videoElement.play();
        if (mounted) {
          setStream(newStream);
          addDebugMessage('Camera initialized successfully');
        }
      } catch (error) {
        if (mounted) {
          addDebugMessage(`Camera initialization error: ${error}`);
          setError('Could not initialize camera. Please ensure permissions are granted and no other app is using the camera.');
          setIsCameraOpen(false);
        }
      }
    };

    initializeCamera();

    return () => {
      mounted = false;
      if (videoElement?.srcObject) {
        const currentStream = videoElement.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
      }
    };
  }, [isCameraOpen]);

  const startCamera = () => {
    addDebugMessage('Starting camera...');
    setIsCameraOpen(true);
  };

  const resetAll = (clearImage = false) => {
    const videoElement = videoRef.current;
    if (videoElement?.srcObject) {
      const currentStream = videoElement.srcObject as MediaStream;
      currentStream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    }
    setStream(null);
    if (clearImage) {
      setImage(null);
    }
    setAnalysis(null);
    setError(null);
    setIsCameraOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    addDebugMessage('Reset completed');
  };

  const captureImage = () => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      setError('Video stream not available');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // First draw the video frame
      ctx.drawImage(videoElement, 0, 0);
      
      // For mirrored image, do a second draw with flip
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(videoElement, -canvas.width, 0);
      ctx.restore();
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImage(dataUrl);
      addDebugMessage('Image captured successfully');
      
      setIsCameraOpen(false);
      if (videoElement.srcObject) {
        const currentStream = videoElement.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
      }
      setStream(null);
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
      addDebugMessage('Initializing face analysis...');
      const analysisService = new FaceAnalysisService();
      await analysisService.initialize();
      addDebugMessage('Face detection model loaded');

      const img = new Image();
      img.src = image!;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      addDebugMessage('Image prepared for analysis');

      const result = await analysisService.analyzeFace(img);
      addDebugMessage(`Analysis complete - Face Shape: ${result.faceShape}, Skin Tone: ${result.skinTone}`);

      setAnalysis({
        faceShape: result.faceShape,
        skinTone: result.skinTone,
        recommendations: result.recommendations
      });

    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message || 'Failed to analyze image. Please ensure your face is clearly visible and try again.');
      addDebugMessage(`Analysis error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6">Selfie Analysis</h2>
      
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
              onClick={() => resetAll(true)}
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
              onClick={() => resetAll(true)}
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
            onClick={() => resetAll(true)}
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