import React from 'react';

interface ChurchLogoProps {
  className?: string;
}

// 실제 교회 로고 이미지 사용
export const ChurchLogo: React.FC<ChurchLogoProps> = ({ className = "w-10 h-10" }) => {
  return (
    <img 
      src="/church_logo.png" 
      alt="창원섬김의교회 로고"
      className={className} 
    />
  );
};
