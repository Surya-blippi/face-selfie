import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import '@tensorflow/tfjs-backend-webgl';

interface FaceAnalysisResult {
  faceShape: string;
  skinTone: string;
  recommendations: string[];
  measurements: {
    faceWidth: number;
    faceHeight: number;
    jawWidth: number;
    foreheadWidth: number;
    chinLength: number;
  };
}

export class FaceAnalysisService {
  private model: faceDetection.FaceDetector | null = null;

  async initialize() {
    if (!this.model) {
      await tf.ready();
      // Use MediaPipe face detector model
      this.model = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        {
          runtime: 'tfjs',
          //refineLandmarks: true,
          maxFaces: 1
        }
      );
    }
  }

  async analyzeFace(imageElement: HTMLImageElement): Promise<FaceAnalysisResult> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const faces = await this.model.estimateFaces(imageElement);
    
    if (faces.length === 0) {
      throw new Error('No face detected');
    }

    const face = faces[0];
    const keypoints = face.keypoints;

    // Calculate basic measurements from keypoints
    const measurements = this.calculateMeasurements(keypoints);
    const faceShape = this.determineFaceShape(measurements);
    const skinTone = await this.analyzeSkinTone(imageElement);
    const recommendations = this.generateRecommendations(faceShape, skinTone);

    return {
      faceShape,
      skinTone,
      recommendations,
      measurements
    };
  }

  private calculateMeasurements(keypoints: faceDetection.Keypoint[]) {
    // Find key facial points
    const leftEar = keypoints.find(k => k.name === 'leftEar');
    const rightEar = keypoints.find(k => k.name === 'rightEar');
    const nose = keypoints.find(k => k.name === 'noseTip');
    const chin = keypoints.find(k => k.name === 'chin');
    const leftCheek = keypoints.find(k => k.name === 'leftCheek');
    const rightCheek = keypoints.find(k => k.name === 'rightCheek');

    const faceWidth = leftEar && rightEar ? 
      this.distance([leftEar.x, leftEar.y], [rightEar.x, rightEar.y]) : 0;
    const faceHeight = nose && chin ? 
      this.distance([nose.x, nose.y], [chin.x, chin.y]) * 2 : 0;
    const jawWidth = leftCheek && rightCheek ? 
      this.distance([leftCheek.x, leftCheek.y], [rightCheek.x, rightCheek.y]) : 0;

    return {
      faceWidth,
      faceHeight,
      jawWidth,
      foreheadWidth: faceWidth * 0.8, // Estimated
      chinLength: faceHeight * 0.2 // Estimated
    };
  }

  private distance(point1: number[], point2: number[]) {
    return Math.sqrt(
      Math.pow(point2[0] - point1[0], 2) + 
      Math.pow(point2[1] - point1[1], 2)
    );
  }

  private determineFaceShape(measurements: any) {
    const {
      faceWidth,
      faceHeight,
      jawWidth,
      foreheadWidth
    } = measurements;

    const ratio = faceHeight / faceWidth;
    const jawForeheadRatio = jawWidth / foreheadWidth;

    if (ratio > 1.75) return "Oblong";
    if (ratio < 1.25) return "Round";
    if (jawForeheadRatio > 1.1) return "Triangle";
    if (jawForeheadRatio < 0.9) return "Heart";
    if (ratio > 1.5 && ratio < 1.75) return "Square";
    return "Oval";
  }

  private async analyzeSkinTone(imageElement: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);

    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const sampleSize = 50;
    const imageData = ctx.getImageData(
      centerX - sampleSize/2,
      centerY - sampleSize/2,
      sampleSize,
      sampleSize
    );

    let r = 0, g = 0, b = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      r += imageData.data[i];
      g += imageData.data[i + 1];
      b += imageData.data[i + 2];
    }

    const pixelCount = imageData.data.length / 4;
    r = Math.round(r / pixelCount);
    g = Math.round(g / pixelCount);
    b = Math.round(b / pixelCount);

    return this.classifySkinTone(r, g, b);
  }

  private classifySkinTone(r: number, g: number, b: number) {
    const brightness = (r + g + b) / 3;
    const warmth = r - b;

    if (brightness > 200) return "Fair";
    if (brightness > 170) {
      return warmth > 60 ? "Warm Light" : "Cool Light";
    }
    if (brightness > 140) {
      return warmth > 40 ? "Warm Medium" : "Cool Medium";
    }
    if (brightness > 100) {
      return warmth > 30 ? "Warm Deep" : "Cool Deep";
    }
    return "Deep";
  }

  private generateRecommendations(faceShape: string, skinTone: string): string[] {
    const recommendations: string[] = [];

    switch (faceShape) {
      case "Oval":
        recommendations.push(
          "Your balanced face shape suits most hairstyles",
          "Try soft layers to maintain face-length proportion"
        );
        break;
      case "Round":
        recommendations.push(
          "Long, layered cuts will help elongate your face",
          "Side-swept bangs create angles and definition"
        );
        break;
      case "Square":
        recommendations.push(
          "Soft layers and waves will soften angular features",
          "Side-parted styles complement your strong jawline"
        );
        break;
      case "Oblong":
        recommendations.push(
          "Add width with side-swept bangs and waves",
          "Avoid styles that add height at the crown"
        );
        break;
      case "Heart":
        recommendations.push(
          "Side-swept bangs balance your features",
          "Medium-length cuts work well with your face shape"
        );
        break;
      case "Triangle":
        recommendations.push(
          "Add volume at the crown to balance jaw width",
          "Layered cuts that are fuller at the top"
        );
        break;
    }

    if (skinTone.includes("Warm")) {
      recommendations.push(
        "Gold jewelry will complement your warm undertones",
        "Earth-toned and peachy makeup colors will enhance your complexion"
      );
    } else {
      recommendations.push(
        "Silver jewelry will complement your cool undertones",
        "Rose and blue-based makeup colors will enhance your complexion"
      );
    }

    return recommendations;
  }
}