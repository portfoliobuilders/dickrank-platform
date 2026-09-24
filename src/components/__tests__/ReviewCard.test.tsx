import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewCard, mockReviews } from '../reviews/ReviewCard';

describe('ReviewCard', () => {
  const mockHandlers = {
    onHelpful: vi.fn(),
    onReport: vi.fn(),
    onReply: vi.fn(),
  };

  it('renders review with correct rating', () => {
    render(<ReviewCard review={mockReviews[0]} {...mockHandlers} />);
    
    expect(screen.getByText('9.5')).toBeInTheDocument();
    expect(screen.getByText('Exceptional')).toBeInTheDocument();
  });

  it('displays reviewer information when not anonymous', () => {
    render(<ReviewCard review={mockReviews[0]} {...mockHandlers} />);
    
    expect(screen.getByText('HappyClient2024')).toBeInTheDocument();
    expect(screen.getByText('12 reviews')).toBeInTheDocument();
  });

  it('shows anonymous for anonymous reviews', () => {
    render(<ReviewCard review={mockReviews[1]} {...mockHandlers} />);
    
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    expect(screen.getByText('Verified experience')).toBeInTheDocument();
  });

  it('calls onHelpful when helpful button clicked', () => {
    render(<ReviewCard review={mockReviews[0]} {...mockHandlers} />);
    
    const helpfulButton = screen.getByText(/Helpful/);
    fireEvent.click(helpfulButton);
    
    expect(mockHandlers.onHelpful).toHaveBeenCalledWith('review-1');
  });

  it('toggles read more for long reviews', () => {
    const longReview = {
      ...mockReviews[0],
      detailedReview: 'a'.repeat(500),
    };
    
    render(<ReviewCard review={longReview} {...mockHandlers} />);
    
    const readMoreButton = screen.getByText('Read more');
    expect(readMoreButton).toBeInTheDocument();
    
    fireEvent.click(readMoreButton);
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('shows owner response when present', () => {
    render(<ReviewCard review={mockReviews[1]} {...mockHandlers} />);
    
    expect(screen.getByText('Response from owner')).toBeInTheDocument();
    expect(screen.getByText(/Thank you for the feedback/)).toBeInTheDocument();
  });

  it('shows response form for owner', () => {
    render(<ReviewCard review={mockReviews[0]} {...mockHandlers} isOwner />);
    
    const replyButton = screen.getByText('Reply');
    fireEvent.click(replyButton);
    
    expect(screen.getByPlaceholderText('Write your response...')).toBeInTheDocument();
  });
});
