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
    foreheadWidth: number;
    jawWidth: number;
    chinLength: number;
  };
  confidence: number;
}

export class FaceAnalysisService {
  private model: faceDetection.FaceDetector | null = null;

  async initialize() {
    if (!this.model) {
      await tf.ready();
      // Initialize face detector
      this.model = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        {
          runtime: 'tfjs',
          maxFaces: 1
        }
      );
    }
  }

  async analyzeFace(imageElement: HTMLImageElement): Promise<FaceAnalysisResult> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    // Detect faces
    const faces = await this.model.estimateFaces(imageElement, {
      flipHorizontal: false
    });
    
    if (faces.length === 0) {
      throw new Error('No face detected in the image. Please try again with a clearer photo.');
    }

    const face = faces[0];
    const keypoints = face.keypoints;
    const box = face.box;
    const { measurements, confidence } = this.calculateMeasurements(box, keypoints);
    
    const faceShape = this.determineFaceShape(measurements);
    const skinTone = await this.analyzeSkinTone(imageElement);
    const recommendations = this.generateRecommendations(faceShape, skinTone);

    return {
      faceShape,
      skinTone,
      recommendations,
      measurements,
      confidence
    };
  }

  private calculateMeasurements(box: { width: number; height: number }, keypoints: faceDetection.Keypoint[]) {
    // Find key facial points
    const leftEye = keypoints.find(k => k.name === 'leftEye');
    const rightEye = keypoints.find(k => k.name === 'rightEye');
    const nose = keypoints.find(k => k.name === 'noseTip');
    const mouth = keypoints.find(k => k.name === 'mouth');
    const leftCheek = keypoints.find(k => k.name === 'leftCheek');
    const rightCheek = keypoints.find(k => k.name === 'rightCheek');

    // Calculate base measurements
    const faceWidth = box.width;
    const faceHeight = box.height;

    // Calculate distances between key points
    const eyeDistance = leftEye && rightEye ? 
      this.distance([leftEye.x, leftEye.y], [rightEye.x, rightEye.y]) : faceWidth * 0.4;

    const foreheadWidth = eyeDistance * 1.3;
    const jawWidth = (leftCheek && rightCheek) ?
      this.distance([leftCheek.x, leftCheek.y], [rightCheek.x, rightCheek.y]) * 0.9 :
      faceWidth * 0.85;

    const chinLength = (nose && mouth) ?
      this.distance([nose.x, nose.y], [mouth.x, mouth.y]) * 1.5 :
      faceHeight * 0.2;

    // Calculate confidence based on available keypoints
    const keyPointsFound = [leftEye, rightEye, nose, mouth, leftCheek, rightCheek]
      .filter(point => point !== undefined).length;
    const confidence = keyPointsFound / 6; // 6 is total number of key points we look for

    return {
      measurements: {
        faceWidth,
        faceHeight,
        foreheadWidth,
        jawWidth,
        chinLength
      },
      confidence
    };
  }

  private distance(point1: number[], point2: number[]) {
    return Math.sqrt(
      Math.pow(point2[0] - point1[0], 2) + 
      Math.pow(point2[1] - point1[1], 2)
    );
  }

  private determineFaceShape(measurements: {
    faceWidth: number;
    faceHeight: number;
    foreheadWidth: number;
    jawWidth: number;
    chinLength: number;
  }): string {
    const {
      faceWidth,
      faceHeight,
      foreheadWidth,
      jawWidth,
      chinLength
    } = measurements;

    // Calculate key ratios
    const lengthToWidthRatio = faceHeight / faceWidth;
    const foreheadToJawRatio = foreheadWidth / jawWidth;
    const widthToHeightRatio = faceWidth / faceHeight;
    const chinRatio = chinLength / faceHeight;

    // Determine face shape based on ratios
    if (lengthToWidthRatio >= 1.75) {
      return "Oblong";
    }

    if (lengthToWidthRatio < 1.25 && Math.abs(foreheadToJawRatio - 1) < 0.1) {
      return "Round";
    }

    if (foreheadToJawRatio < 0.9) {
      if (chinRatio < 0.15) {
        return "Triangle";
      }
      return "Diamond";
    }

    if (foreheadToJawRatio > 1.1) {
      if (chinRatio < 0.15) {
        return "Heart";
      }
      return "Inverted Triangle";
    }

    if (widthToHeightRatio > 0.65 && widthToHeightRatio < 0.75) {
      if (Math.abs(foreheadToJawRatio - 1) < 0.1) {
        return "Square";
      }
    }

    // Default to Oval if no other shape matches
    return "Oval";
  }

  private async analyzeSkinTone(imageElement: HTMLImageElement): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);

    // Sample from the center of the face
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const sampleSize = 50;
    const imageData = ctx.getImageData(
      centerX - sampleSize/2,
      centerY - sampleSize/2,
      sampleSize,
      sampleSize
    );

    // Calculate average RGB values
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

  private classifySkinTone(r: number, g: number, b: number): string {
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

    // Face shape recommendations
    switch (faceShape) {
      case "Oval":
        recommendations.push(
          "Your balanced face shape complements most hairstyles",
          "Try textured layers to enhance your natural harmony",
          "Both long and short styles work well with your proportions"
        );
        break;
      case "Round":
        recommendations.push(
          "Long, layered cuts and side-swept bangs create length",
          "Avoid blunt bobs that accentuate roundness",
          "Try volume at the crown to elongate your face"
        );
        break;
      case "Square":
        recommendations.push(
          "Soft layers and wispy bangs soften angular features",
          "Side-parts and waves balance strong jawline",
          "Avoid blunt cuts that emphasize angles"
        );
        break;
      case "Diamond":
        recommendations.push(
          "Side-swept bangs complement your cheekbones",
          "Chin-length or longer styles balance facial proportions",
          "Add volume at the forehead and jaw areas"
        );
        break;
      case "Heart":
        recommendations.push(
          "Side-swept bangs balance a wider forehead",
          "Medium-length cuts with layers around the chin",
          "Avoid styles with too much height at the crown"
        );
        break;
      case "Triangle":
        recommendations.push(
          "Volume at the crown balances a wider jaw",
          "Long layers with face-framing pieces",
          "Try side-swept bangs and textured ends"
        );
        break;
      case "Oblong":
        recommendations.push(
          "Short to medium-length cuts add width",
          "Side-swept bangs break up length",
          "Avoid very long or sleek styles"
        );
        break;
    }

    // Skin tone recommendations
    if (skinTone.includes("Warm")) {
      recommendations.push(
        "Gold and copper jewelry enhances your warm undertones",
        "Earth-toned and peachy makeup colors suit your complexion",
        "Try hair colors with golden or copper undertones"
      );
    } else {
      recommendations.push(
        "Silver and platinum jewelry complements your cool undertones",
        "Rose and blue-based makeup colors enhance your complexion",
        "Consider hair colors with ash or cool undertones"
      );
    }

    return recommendations;
  }
}