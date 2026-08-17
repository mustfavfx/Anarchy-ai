import React, { useState } from 'react';
import { Palette, Check, Search, X } from 'lucide-react';
import { RAL_COLORS, type RalColor } from '../../../config/ralColors';
import './RalColorPicker.css';

interface RalColorPickerProps {
  onSelectColor: (ral: RalColor) => void;
  onClose?: () => void;
}

export const RalColorPicker: React.FC<RalColorPickerProps> = ({ onSelectColor, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const categories = ['All', 'Whites & Off-Whites', 'Greys', 'Greens', 'Beiges & Browns', 'Blues', 'Reds & Oranges', 'Accents'];

  const filteredColors = RAL_COLORS.filter(color => {
    const matchesCategory = selectedCategory === 'All' || color.category === selectedCategory;
    const matchesQuery = searchQuery === '' || 
      color.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      color.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      color.nameAr.includes(searchQuery);
    return matchesCategory && matchesQuery;
  });

  const handlePick = (color: RalColor) => {
    setCopiedCode(color.code);
    onSelectColor(color);
    setTimeout(() => setCopiedCode(null), 1200);
  };

  return (
    <div className="ral-picker-container">
      <div className="ral-picker-header">
        <div className="ral-header-title">
          <Palette size={16} className="ral-icon" />
          <span>Architectural RAL Color Palette (ألوان RAL المعمارية)</span>
        </div>
        {onClose && (
          <button className="ral-close-btn" onClick={onClose}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="ral-filter-bar">
        <div className="ral-search-box">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            placeholder="Search RAL code or color name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="ral-categories-scroll">
          {categories.map(cat => (
            <button
              key={cat}
              className={`ral-cat-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="ral-colors-grid">
        {filteredColors.map(color => (
          <button
            key={color.code}
            className={`ral-card ${copiedCode === color.code ? 'selected' : ''}`}
            onClick={() => handlePick(color)}
            title={`${color.code} - ${color.name} (${color.nameAr})`}
          >
            <div className="ral-swatch" style={{ backgroundColor: color.hex }}>
              {copiedCode === color.code && <Check size={14} className="check-icon" />}
            </div>
            <div className="ral-info">
              <span className="ral-code">{color.code}</span>
              <span className="ral-name">{color.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
