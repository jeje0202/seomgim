// 이미지 압축 및 리사이징 유틸리티
import imageCompression from 'browser-image-compression';

// 1080p 이미지 압축 옵션 (최대 1920x1080)
const fullImageOptions = {
  maxSizeMB: 1,              // 최대 파일 크기 1MB
  maxWidthOrHeight: 1920,    // 최대 너비/높이 1920px (1080p)
  useWebWorker: true,        // 웹 워커 사용 (성능 향상)
  fileType: 'image/jpeg',    // JPEG 형식으로 변환
  initialQuality: 0.85       // 초기 품질 85%
};

// 썸네일 압축 옵션 (화질 개선 및 적절한 크기)
const thumbnailOptions = {
  maxSizeMB: 0.15,           // 최대 파일 크기 150KB (화질 개선을 위해 증가)
  maxWidthOrHeight: 600,     // 최대 너비/높이 600px (모달 가로 80vw의 30% = 약 24vw, 고해상도 화면 고려)
  useWebWorker: true,        // 웹 워커 사용
  fileType: 'image/jpeg',    // JPEG 형식으로 변환
  initialQuality: 0.85       // 초기 품질 85% (화질 개선)
};

// 이미지 압축 함수 (1080p)
export const compressTo1080p = async (file: File): Promise<File> => {
  try {
    // 이미 작은 파일은 압축하지 않음 (500KB 미만이고 1920px 이하)
    if (file.size < 500 * 1024) {
      // 이미지 크기 확인
      const img = new Image();
      const url = URL.createObjectURL(file);
      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          resolve({ width: 0, height: 0 });
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });

      // 이미 1080p 이하이면 원본 반환
      if (dimensions.width <= 1920 && dimensions.height <= 1920) {
        return file;
      }
    }

    const compressedFile = await imageCompression(file, fullImageOptions);
    
    // 압축된 파일의 mimetype을 명시적으로 설정 (browser-image-compression이 제대로 설정하지 않을 수 있음)
    const blob = compressedFile instanceof Blob ? compressedFile : new Blob([compressedFile], { type: 'image/jpeg' });
    const finalFile = new File([blob], compressedFile.name || file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
    
    const sizeReduction = ((1 - finalFile.size / file.size) * 100).toFixed(1);
    console.log(`[이미지 압축 1080p] 원본: ${(file.size / 1024 / 1024).toFixed(2)}MB → 압축: ${(finalFile.size / 1024 / 1024).toFixed(2)}MB (${sizeReduction}% 감소)`);
    return finalFile;
  } catch (error) {
    console.error('이미지 압축 오류 (1080p):', error);
    // 압축 실패 시 원본 파일 반환
    return file;
  }
};

// 썸네일 생성 함수
export const createThumbnail = async (file: File): Promise<File> => {
  try {
    const thumbnailFile = await imageCompression(file, thumbnailOptions);
    
    // 압축된 파일의 mimetype을 명시적으로 설정
    const blob = thumbnailFile instanceof Blob ? thumbnailFile : new Blob([thumbnailFile], { type: 'image/jpeg' });
    const finalFile = new File([blob], thumbnailFile.name || 'thumbnail.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
    
    const sizeReduction = ((1 - finalFile.size / file.size) * 100).toFixed(1);
    console.log(`[썸네일 생성] 원본: ${(file.size / 1024 / 1024).toFixed(2)}MB → 썸네일: ${(finalFile.size / 1024).toFixed(2)}KB (${sizeReduction}% 감소)`);
    return finalFile;
  } catch (error) {
    console.error('썸네일 생성 오류:', error);
    // 썸네일 생성 실패 시 원본 파일 반환
    return file;
  }
};

// 이미지와 썸네일 모두 생성
export interface CompressedImageResult {
  fullImage: File;      // 1080p 이미지
  thumbnail: File;      // 썸네일
  originalSize: number; // 원본 크기
  fullSize: number;     // 1080p 크기
  thumbnailSize: number; // 썸네일 크기
}

export const compressImageWithThumbnail = async (file: File): Promise<CompressedImageResult> => {
  const originalSize = file.size;
  
  // 1080p 이미지와 썸네일을 병렬로 생성
  const [fullImage, thumbnail] = await Promise.all([
    compressTo1080p(file),
    createThumbnail(file)
  ]);

  return {
    fullImage,
    thumbnail,
    originalSize,
    fullSize: fullImage.size,
    thumbnailSize: thumbnail.size
  };
};

// 여러 이미지 압축 (병렬 처리)
export const compressImagesWithThumbnails = async (files: File[]): Promise<CompressedImageResult[]> => {
  console.log(`[이미지 압축] ${files.length}개 이미지 압축 시작...`);
  const startTime = Date.now();
  
  try {
    const results = await Promise.all(
      files.map(async (file, index) => {
        try {
          return await compressImageWithThumbnail(file);
        } catch (error: any) {
          console.error(`[이미지 압축] 파일 ${index + 1} 압축 실패:`, error);
          throw new Error(`이미지 ${index + 1} 압축 실패: ${error.message || '알 수 없는 오류'}`);
        }
      })
    );
    
    const endTime = Date.now();
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalFullSize = results.reduce((sum, r) => sum + r.fullSize, 0);
    const totalThumbnailSize = results.reduce((sum, r) => sum + r.thumbnailSize, 0);
    
    console.log(`[이미지 압축] 완료 (${((endTime - startTime) / 1000).toFixed(1)}초)`);
    console.log(`  원본 총 크기: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  1080p 총 크기: ${(totalFullSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  썸네일 총 크기: ${(totalThumbnailSize / 1024).toFixed(2)}KB`);
    console.log(`  크기 감소율: ${((1 - totalFullSize / totalOriginalSize) * 100).toFixed(1)}%`);
    
    return results;
  } catch (error: any) {
    console.error(`[이미지 압축] 전체 압축 실패:`, error);
    throw error;
  }
};

