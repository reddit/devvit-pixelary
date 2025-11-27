type Tab = 'raw' | 'editor-funnel' | 'drawing-ctr' | 'words';

type TabsProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export function Tabs(props: TabsProps) {
  const { activeTab, onTabChange } = props;

  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => onTabChange('raw')}
        className={`px-4 py-2 font-medium text-sm transition-colors ${
          activeTab === 'raw'
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        Raw Events
      </button>
      <button
        onClick={() => onTabChange('editor-funnel')}
        className={`px-4 py-2 font-medium text-sm transition-colors ${
          activeTab === 'editor-funnel'
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        Editor Funnel
      </button>
      <button
        onClick={() => onTabChange('drawing-ctr')}
        className={`px-4 py-2 font-medium text-sm transition-colors ${
          activeTab === 'drawing-ctr'
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        Drawing CTR
      </button>
      <button
        onClick={() => onTabChange('words')}
        className={`px-4 py-2 font-medium text-sm transition-colors ${
          activeTab === 'words'
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        Words
      </button>
    </div>
  );
}

