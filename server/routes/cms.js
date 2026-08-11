/**
 * [파일 용도] 슈퍼관리자 전용 CMS 콘텐츠 및 SQLite 기반 이력/복구 라우터
 * 웹사이트 주요 영역의 내용 조회, 수정, 이력 조회, 복구 API 구현
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllSections,
  getSection,
  updateSection,
  getSectionHistory,
  restoreSectionVersion
} = require('../config/sqlite');

// 1. 전체 영역 CMS 최신 내용 조회 (비로그인 사용자 포함 누구나 조회 가능)
router.get('/sections', async (req, res) => {
  try {
    const rows = await getAllSections();
    const result = {};
    rows.forEach(row => {
      let parsedContent = {};
      try {
        parsedContent = JSON.parse(row.content_json);
      } catch (e) {
        parsedContent = { raw: row.content_json };
      }
      result[row.section_key] = {
        section_key: row.section_key,
        title: row.title,
        content: parsedContent,
        current_version: row.current_version,
        updated_at: row.updated_at,
        updated_by: row.updated_by
      };
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('CMS 전체 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: 'CMS 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 2. 단일 영역 CMS 최신 내용 조회
router.get('/sections/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const row = await getSection(key);
    if (!row) {
      return res.status(404).json({ success: false, message: '해당 CMS 영역을 찾을 수 없습니다.' });
    }

    let parsedContent = {};
    try {
      parsedContent = JSON.parse(row.content_json);
    } catch (e) {
      parsedContent = { raw: row.content_json };
    }

    res.json({
      success: true,
      data: {
        section_key: row.section_key,
        title: row.title,
        content: parsedContent,
        current_version: row.current_version,
        updated_at: row.updated_at,
        updated_by: row.updated_by
      }
    });
  } catch (error) {
    console.error('CMS 섹션 조회 오류:', error);
    res.status(500).json({ success: false, message: 'CMS 섹션 조회 중 오류가 발생했습니다.' });
  }
});

// 3. 슈퍼관리자 전용: 섹션 내용 수정 및 이력 누적 (super-admin 권한 필수)
router.put('/sections/:key', authenticate, authorize('super-admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const { title, content, change_memo } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: '수정할 콘텐츠 내용이 필요합니다.' });
    }

    const contentJson = typeof content === 'string' ? content : JSON.stringify(content);
    const updatedBy = req.user.name || req.user.nickname || req.user.username || '슈퍼관리자';
    const sectionTitle = title || key;

    const result = await updateSection(key, sectionTitle, contentJson, updatedBy, change_memo);

    let parsedContent = {};
    try {
      parsedContent = JSON.parse(result.content_json);
    } catch (e) {
      parsedContent = { raw: result.content_json };
    }

    res.json({
      success: true,
      message: '성공적으로 저장되었습니다.',
      data: {
        section_key: result.section_key,
        title: result.title,
        content: parsedContent,
        current_version: result.current_version,
        updated_at: result.updated_at,
        updated_by: result.updated_by
      }
    });
  } catch (error) {
    console.error('CMS 섹션 저장 오류:', error);
    res.status(500).json({ success: false, message: 'CMS 섹션 저장 중 오류가 발생했습니다.' });
  }
});

// 4. 슈퍼관리자 전용: 특정 영역 변경 이력 목록 조회 (super-admin 권한 필수)
router.get('/sections/:key/history', authenticate, authorize('super-admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const historyRows = await getSectionHistory(key);

    const formattedHistory = historyRows.map(row => {
      let parsed = {};
      try {
        parsed = JSON.parse(row.content_json);
      } catch (e) {
        parsed = { raw: row.content_json };
      }
      return {
        history_id: row.history_id,
        section_key: row.section_key,
        version: row.version,
        content: parsed,
        change_memo: row.change_memo,
        created_at: row.created_at,
        created_by: row.created_by
      };
    });

    res.json({ success: true, data: formattedHistory });
  } catch (error) {
    console.error('CMS 이력 조회 오류:', error);
    res.status(500).json({ success: false, message: 'CMS 이력 조회 중 오류가 발생했습니다.' });
  }
});

// 5. 슈퍼관리자 전용: 과거 특정 버전으로 복구 (super-admin 권한 필수)
router.post('/sections/:key/restore/:historyId', authenticate, authorize('super-admin'), async (req, res) => {
  try {
    const { key, historyId } = req.params;
    const restoredBy = req.user.name || req.user.nickname || req.user.username || '슈퍼관리자';

    const result = await restoreSectionVersion(key, parseInt(historyId, 10), restoredBy);

    let parsedContent = {};
    try {
      parsedContent = JSON.parse(result.content_json);
    } catch (e) {
      parsedContent = { raw: result.content_json };
    }

    res.json({
      success: true,
      message: `성공적으로 이전 버전(이력 ID: ${historyId}) 내용으로 복구되었습니다.`,
      data: {
        section_key: result.section_key,
        title: result.title,
        content: parsedContent,
        current_version: result.current_version,
        updated_at: result.updated_at,
        updated_by: result.updated_by
      }
    });
  } catch (error) {
    console.error('CMS 이력 복구 오류:', error);
    res.status(500).json({ success: false, message: error.message || 'CMS 이력 복구 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
