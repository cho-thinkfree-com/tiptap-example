import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resourcesPath = path.join(__dirname, 'src', 'lib', 'i18n', 'resources.json');
const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'));

// Dashboard translations
const dashboardTranslations = {
    'en-US': {
        title: 'Dashboard',
        workspaces: 'Workspaces',
        recentDocuments: 'Recent Documents',
        files: 'Files',
        createWorkspace: 'Create Workspace',
        newFolder: 'New Folder',
        newDocument: 'New Document',
        rename: 'Rename',
        delete: 'Delete',
        open: 'Open',
        name: 'Name',
        workspace: 'Workspace',
        lastModified: 'Last Modified',
        modifiedBy: 'Modified By',
        actions: 'Actions',
        searchDocuments: 'Search documents...',
        confirmDeletion: 'Confirm Deletion',
        areYouSure: 'Are you sure you want to delete "{name}"? This action cannot be undone.',
        cancel: 'Cancel',
        noWorkspacesFound: 'No workspaces found',
        noRecentDocuments: 'No recent documents found.',
        folderEmpty: 'This folder is empty.',
        createFirstDocument: 'Create your first document',
        manageDocuments: 'Manage your workspaces and documents.'
    },
    'ko-KR': {
        title: '대시보드',
        workspaces: '워크스페이스',
        recentDocuments: '최근 문서',
        files: '파일',
        createWorkspace: '워크스페이스 생성',
        newFolder: '새 폴더',
        newDocument: '새 문서',
        rename: '이름 변경',
        delete: '삭제',
        open: '열기',
        name: '이름',
        workspace: '워크스페이스',
        lastModified: '마지막 수정',
        modifiedBy: '수정자',
        actions: '작업',
        searchDocuments: '문서 검색...',
        confirmDeletion: '삭제 확인',
        areYouSure: '"{name}"을(를) 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
        cancel: '취소',
        noWorkspacesFound: '워크스페이스가 없습니다',
        noRecentDocuments: '최근 문서가 없습니다.',
        folderEmpty: '이 폴더는 비어 있습니다.',
        createFirstDocument: '첫 번째 문서 만들기',
        manageDocuments: '워크스페이스와 문서를 관리하세요.'
    },
    'ja-JP': {
        title: 'ダッシュボード',
        workspaces: 'ワークスペース',
        recentDocuments: '最近の文書',
        files: 'ファイル',
        createWorkspace: 'ワークスペースを作成',
        newFolder: '新しいフォルダ',
        newDocument: '新しい文書',
        rename: '名前を変更',
        delete: '削除',
        open: '開く',
        name: '名前',
        workspace: 'ワークスペース',
        lastModified: '最終更新',
        modifiedBy: '更新者',
        actions: 'アクション',
        searchDocuments: '文書を検索...',
        confirmDeletion: '削除の確認',
        areYouSure: '"{name}"を削除してもよろしいですか？この操作は元に戻せません。',
        cancel: 'キャンセル',
        noWorkspacesFound: 'ワークスペースが見つかりません',
        noRecentDocuments: '最近の文書がありません。',
        folderEmpty: 'このフォルダは空です。',
        createFirstDocument: '最初の文書を作成',
        manageDocuments: 'ワークスペースと文書を管理します。'
    }
};

// Add dashboard translations to each locale
Object.keys(dashboardTranslations).forEach(locale => {
    if (!resources[locale]) {
        resources[locale] = {};
    }
    if (!resources[locale].dashboard) {
        resources[locale].dashboard = {};
    }
    resources[locale].dashboard = {
        ...resources[locale].dashboard,
        ...dashboardTranslations[locale]
    };
});

fs.writeFileSync(resourcesPath, JSON.stringify(resources, null, 2), 'utf8');
console.log('Dashboard translations added successfully!');
