export const THEMIS_COLLECTIONS = {
  USERS: 'users',
  CONTRACTS: 'contracts',
  CONTRACT_CLAUSES: 'contract_clauses',
  COMMUNITY_COMMENTS: 'community_comments',
  CHATROOMS: 'chatrooms',
  CHATROOM_MEMBERS: 'chatroom_members',
};

export const CONTRACT_TYPES = ['전세', '월세', '매매', '근로', '프리랜서', '기타'];

export const CHATROOM_TYPES = ['피해자모임', '전문가상담', '일반'];

export const CHATROOM_MEMBER_ROLES = ['방장', '멤버', '전문가'];

export const THEMIS_ERD = [
  {
    key: THEMIS_COLLECTIONS.USERS,
    title: 'users',
    description: 'Firebase Auth 사용자 프로필 저장소',
    fields: [
      'uid',
      'email',
      'nickname',
      'phone',
      'profile_image_url',
      'joined_at',
      'created_at',
      'updated_at',
    ],
    notes: ['Firebase Auth가 password_hash를 관리하므로 Firestore에는 저장하지 않음'],
  },
  {
    key: THEMIS_COLLECTIONS.CONTRACTS,
    title: 'contracts',
    description: '계약서 원본과 AI 분석 결과',
    fields: [
      'user_id',
      'contract_type',
      'original_image_url',
      'ocr_text',
      'risk_score',
      'risk_percentile',
      'risk_label',
      'analyzed_at',
      'created_at',
    ],
    notes: ['user_id로 users 문서를 참조'],
  },
  {
    key: THEMIS_COLLECTIONS.CONTRACT_CLAUSES,
    title: 'contract_clauses',
    description: '계약서 조항 단위 분석 결과',
    fields: ['contract_id', 'clause_number', 'clause_title', 'clause_text', 'risk_score', 'risk_label', 'created_at'],
    notes: ['contract_id로 contracts 문서를 참조'],
  },
  {
    key: THEMIS_COLLECTIONS.COMMUNITY_COMMENTS,
    title: 'community_comments',
    description: '커뮤니티 게시글 댓글',
    fields: ['post_id', 'user_id', 'content', 'is_expert_answer', 'created_at'],
    notes: ['post_id로 게시글, user_id로 users 문서를 참조'],
  },
  {
    key: THEMIS_COLLECTIONS.CHATROOMS,
    title: 'chatrooms',
    description: '게시글에서 파생되는 상담/모임 채팅방',
    fields: ['origin_post_id', 'name', 'room_type', 'member_count', 'is_sos_eligible', 'created_at'],
    notes: ['origin_post_id 기준으로 관련 채팅방을 묶음'],
  },
  {
    key: THEMIS_COLLECTIONS.CHATROOM_MEMBERS,
    title: 'chatroom_members',
    description: '채팅방 참여자 목록',
    fields: ['chatroom_id', 'user_id', 'role', 'joined_at'],
    notes: ['chatroom_id로 chatrooms, user_id로 users 문서를 참조'],
  },
];
