import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const modules = {
    toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large'] }],
        [{ 'color': [] }],
        ['clean']
    ],
};

const formats = [
    'bold', 'italic', 'underline',
    'font', 'size', 'color'
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    value,
    onChange,
    placeholder = 'Açıklama yazın...'
}) => {
    return (
        <div className="rich-text-editor">
            <ReactQuill
                theme="snow"
                value={value}
                onChange={onChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                className="bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600"
            />
            <style>{`
        .rich-text-editor .ql-container {
          min-height: 80px;
          font-family: inherit;
          font-size: 14px;
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
        }
        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: #f9fafb;
        }
        .dark .rich-text-editor .ql-toolbar {
          background: #334155;
          border-color: #475569;
        }
        .dark .rich-text-editor .ql-container {
          border-color: #475569;
        }
        .dark .rich-text-editor .ql-editor {
          color: #e2e8f0;
        }
        .dark .rich-text-editor .ql-editor.ql-blank::before {
          color: #64748b;
        }
        .dark .rich-text-editor .ql-stroke {
          stroke: #94a3b8;
        }
        .dark .rich-text-editor .ql-fill {
          fill: #94a3b8;
        }
        .dark .rich-text-editor .ql-picker-label {
          color: #94a3b8;
        }
        .rich-text-editor .ql-editor {
          min-height: 60px;
        }
      `}</style>
        </div>
    );
};
