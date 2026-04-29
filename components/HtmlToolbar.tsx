// HTML 서식 도구바 컴포넌트
import React, { useState, useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link, Type, Palette, Minus
} from 'lucide-react';

interface HtmlToolbarProps {
  targetRef: React.RefObject<HTMLDivElement>;
  onContentChange?: () => void;
}

const HtmlToolbar: React.FC<HtmlToolbarProps> = ({ targetRef, onContentChange }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const bgColorPickerRef = useRef<HTMLDivElement>(null);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLDivElement>(null);

  const colors = [
    '#000000', '#333333', '#666666', '#999999', '#cccccc',
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
    '#991b1b', '#9a3412', '#854d0e', '#166534', '#115e59',
    '#1e40af', '#3730a3', '#6b21a8', '#9d174d', '#be123c',
  ];

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setShowColorPicker(false);
      }
      if (bgColorPickerRef.current && !bgColorPickerRef.current.contains(target)) {
        setShowBgColorPicker(false);
      }
      if (headingMenuRef.current && !headingMenuRef.current.contains(target)) {
        setShowHeadingMenu(false);
      }
      if (linkInputRef.current && !linkInputRef.current.contains(target)) {
        setShowLinkInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const execCommand = (command: string, value?: string) => {
    // 포커스가 ContentEditable에 있는지 확인
    if (targetRef.current) {
      targetRef.current.focus();
    }
    document.execCommand(command, false, value);
    onContentChange?.();
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSavedRange(selection.getRangeAt(0).cloneRange());
    }
  };

  const restoreSelection = () => {
    if (savedRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
  };

  const handleLink = () => {
    saveSelection();
    setShowLinkInput(true);
    setLinkUrl('');
  };

  const applyLink = () => {
    if (linkUrl.trim()) {
      restoreSelection();
      let url = linkUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      execCommand('createLink', url);
      // 링크에 target="_blank" 추가
      if (targetRef.current) {
        const links = targetRef.current.querySelectorAll('a');
        links.forEach(link => {
          if (link.href === url) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.style.color = '#3b82f6';
            link.style.textDecoration = 'underline';
          }
        });
      }
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  const handleHeading = (level: string) => {
    if (level === 'p') {
      execCommand('formatBlock', '<p>');
    } else {
      execCommand('formatBlock', `<${level}>`);
    }
    setShowHeadingMenu(false);
  };

  const handleFontColor = (color: string) => {
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const handleBgColor = (color: string) => {
    execCommand('hiliteColor', color);
    setShowBgColorPicker(false);
  };

  const ToolButton = ({ onClick, title, children, active = false }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    active?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${active ? 'bg-slate-200 text-teal-600' : 'text-slate-600'}`}
    >
      {children}
    </button>
  );

  const Divider = () => (
    <div className="w-px h-6 bg-slate-300 mx-0.5" />
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border border-slate-300 border-b-0 rounded-t-lg">
      {/* 헤딩 */}
      <div className="relative" ref={headingMenuRef}>
        <ToolButton
          onClick={() => setShowHeadingMenu(!showHeadingMenu)}
          title="제목/본문"
        >
          <Type size={16} />
        </ToolButton>
        {showHeadingMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[120px]">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 rounded-t-lg"
              onClick={() => handleHeading('p')}
            >
              본문
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-lg font-bold hover:bg-slate-100"
              onClick={() => handleHeading('h1')}
            >
              제목 1
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-base font-bold hover:bg-slate-100"
              onClick={() => handleHeading('h2')}
            >
              제목 2
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm font-bold hover:bg-slate-100 rounded-b-lg"
              onClick={() => handleHeading('h3')}
            >
              제목 3
            </button>
          </div>
        )}
      </div>

      <Divider />

      {/* 텍스트 서식 */}
      <ToolButton onClick={() => execCommand('bold')} title="굵게 (Ctrl+B)">
        <Bold size={16} />
      </ToolButton>
      <ToolButton onClick={() => execCommand('italic')} title="기울임 (Ctrl+I)">
        <Italic size={16} />
      </ToolButton>
      <ToolButton onClick={() => execCommand('underline')} title="밑줄 (Ctrl+U)">
        <Underline size={16} />
      </ToolButton>
      <ToolButton onClick={() => execCommand('strikeThrough')} title="취소선">
        <Strikethrough size={16} />
      </ToolButton>

      <Divider />

      {/* 글자색 */}
      <div className="relative" ref={colorPickerRef}>
        <ToolButton
          onClick={() => {
            saveSelection();
            setShowColorPicker(!showColorPicker);
            setShowBgColorPicker(false);
          }}
          title="글자색"
        >
          <span className="flex flex-col items-center">
            <span className="text-xs font-bold leading-none">A</span>
            <span className="w-4 h-1 bg-red-500 rounded-sm mt-0.5" />
          </span>
        </ToolButton>
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
            <div className="grid grid-cols-5 gap-1">
              {colors.map(color => (
                <button
                  key={color}
                  type="button"
                  className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    restoreSelection();
                    handleFontColor(color);
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 배경색 */}
      <div className="relative" ref={bgColorPickerRef}>
        <ToolButton
          onClick={() => {
            saveSelection();
            setShowBgColorPicker(!showBgColorPicker);
            setShowColorPicker(false);
          }}
          title="배경색"
        >
          <Palette size={16} />
        </ToolButton>
        {showBgColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform flex items-center justify-center text-[8px] text-slate-500"
                onClick={() => {
                  restoreSelection();
                  handleBgColor('transparent');
                }}
                title="배경 없음"
              >
                ✕
              </button>
              {colors.slice(0, -1).map(color => (
                <button
                  key={`bg-${color}`}
                  type="button"
                  className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color + '40' }}
                  onClick={() => {
                    restoreSelection();
                    handleBgColor(color + '40');
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* 정렬 */}
      <ToolButton onClick={() => execCommand('justifyLeft')} title="왼쪽 정렬">
        <AlignLeft size={16} />
      </ToolButton>
      <ToolButton onClick={() => execCommand('justifyCenter')} title="가운데 정렬">
        <AlignCenter size={16} />
      </ToolButton>
      <ToolButton onClick={() => execCommand('justifyRight')} title="오른쪽 정렬">
        <AlignRight size={16} />
      </ToolButton>

      <Divider />

      {/* 리스트 */}
      <ToolButton onClick={() => execCommand('insertUnorderedList')} title="글머리 기호">
        <List size={16} />
      </ToolButton>
      <ToolButton onClick={() => execCommand('insertOrderedList')} title="번호 매기기">
        <ListOrdered size={16} />
      </ToolButton>

      <Divider />

      {/* 구분선 */}
      <ToolButton onClick={() => execCommand('insertHorizontalRule')} title="구분선">
        <Minus size={16} />
      </ToolButton>

      {/* 링크 */}
      <div className="relative" ref={linkInputRef}>
        <ToolButton onClick={handleLink} title="링크 삽입">
          <Link size={16} />
        </ToolButton>
        {showLinkInput && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[250px]">
            <div className="flex gap-1">
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="URL을 입력하세요"
                className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={applyLink}
                className="px-2 py-1 text-xs bg-teal-500 text-white rounded hover:bg-teal-600"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HtmlToolbar;
