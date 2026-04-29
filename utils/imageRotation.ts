// 이미지 회전 유틸리티

// 이미지를 회전시키는 함수
export const rotateImage = async (file: File, degrees: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context를 가져올 수 없습니다.'));
        return;
      }
      
      // 회전 각도에 따라 캔버스 크기 조정
      let width = img.width;
      let height = img.height;
      
      if (degrees === 90 || degrees === 270) {
        // 90도 또는 270도 회전 시 가로/세로 교체
        width = img.height;
        height = img.width;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 캔버스 중앙으로 이동
      ctx.translate(width / 2, height / 2);
      // 회전
      ctx.rotate((degrees * Math.PI) / 180);
      // 이미지 그리기 (중앙 기준)
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      // Canvas를 Blob으로 변환
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          
          if (!blob) {
            reject(new Error('이미지 회전에 실패했습니다.'));
            return;
          }
          
          // 원본 파일명과 확장자 유지
          const ext = file.name.split('.').pop() || 'jpg';
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          const rotatedFile = new File([blob], `${nameWithoutExt}_rotated.${ext}`, {
            type: file.type || 'image/jpeg',
            lastModified: Date.now()
          });
          
          resolve(rotatedFile);
        },
        file.type || 'image/jpeg',
        0.95 // 품질 95%
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 로드할 수 없습니다.'));
    };
    
    img.src = url;
  });
};

// 이미지를 90도 시계방향 회전
export const rotateImage90 = (file: File): Promise<File> => {
  return rotateImage(file, 90);
};

// 이미지를 90도 반시계방향 회전 (270도 시계방향)
export const rotateImage270 = (file: File): Promise<File> => {
  return rotateImage(file, 270);
};

// 이미지를 180도 회전
export const rotateImage180 = (file: File): Promise<File> => {
  return rotateImage(file, 180);
};

