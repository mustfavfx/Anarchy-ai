import React from 'react';
import './ProjectCard.css';

interface ProjectCardProps {
  title: string;
  image: string;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ title, image }) => {
  return (
    <div className="project-card">
      <div className="project-card-image">
        <img src={image} alt={title} />
        <div className="project-card-overlay">
          <span className="project-card-title">{title}</span>
        </div>
      </div>
    </div>
  );
};
