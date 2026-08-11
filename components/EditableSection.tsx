/**
 * [파일 용도] 영역 크기 고정 및 슈퍼관리자 전용 편집 오버레이 버튼을 제공하는 래퍼 컴포넌트
 * 영역의 레이아웃 규격(크기)은 고정하고 슈퍼관리자 로그인 시 상단에 편집 버튼을 표시함
 */

import React from 'react';
import { Edit3 } from 'lucide-react';
import { User } from '../services/authApi';

interface EditableSectionProps {
  sectionKey: string;
  sectionTitle: string;
  user: User | null;
  className?: string;
  fixedContainerStyle?: React.CSSProperties; // 영역 고정 사이즈 및 오버플로우 스타일 규격
  onEditClick: (sectionKey: string) => void;
  children: React.ReactNode;
}

const EditableSection: React.FC<EditableSectionProps> = ({
  sectionKey,
  sectionTitle,
  user,
  className = '',
  fixedContainerStyle = {},
  onEditClick,
  children
}) => {
  // 슈퍼관리자 권한 확인 (role === 'super-admin')
  const isSuperAdmin = user && user.role === 'super-admin';

  // [한글 코멘트] 사용자 요청: 개별 영역의 편집 버튼은 숨기고 상단 메인 제어 바를 통해서만 전체 편집하도록 처리
  return (
    <div className={`relative group ${className}`}>
      {/* 영역의 크기(레이아웃) 고정 컨테이너 */}

      {/* 2. 영역의 크기(레이아웃) 고정 컨테이너 */}
      <div style={fixedContainerStyle} className="w-full">
        {children}
      </div>
    </div>
  );
};

export default EditableSection;
