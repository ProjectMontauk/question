import React, { useState, useEffect, useCallback } from 'react';
import Comment from './Comment';

// Backend API base URL - use Next.js API routes for both dev and production
const API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://mvpshell.vercel.app' : '';

interface Evidence {
  id: number;
  type: 'yes' | 'no';
  title: string;
  url?: string;
  description: string;
  netVotes: number;
  walletAddress: string;
  createdAt?: string;
}

interface CommentData {
  id: number;
  content: string;
  walletAddress: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  userVote?: string | null;
  replies: CommentData[];
}

interface CommentsModalProps {
  evidence: Evidence | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserAddress?: string;
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  evidence,
  isOpen,
  onClose,
  currentUserAddress
}) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!evidence) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        evidenceId: evidence.id.toString()
      });
      
      if (currentUserAddress) {
        params.append('walletAddress', currentUserAddress);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/comments?${params}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [evidence, currentUserAddress]);

  // Fetch comments when modal opens
  useEffect(() => {
    if (isOpen && evidence) {
      fetchComments();
    }
  }, [isOpen, evidence, fetchComments]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !evidence || !currentUserAddress) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceId: evidence.id,
          content: newComment,
          walletAddress: currentUserAddress
        })
      });

      if (response.ok) {
        setNewComment('');
        await fetchComments(); // Refresh comments
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId: number, content: string) => {
    if (!evidence || !currentUserAddress) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceId: evidence.id,
          parentId,
          content,
          walletAddress: currentUserAddress
        })
      });

      if (response.ok) {
        await fetchComments(); // Refresh comments
      }
    } catch (error) {
      console.error('Failed to submit reply:', error);
      throw error;
    }
  };

  const handleVote = async (commentId: number, voteType: 'upvote' | 'downvote') => {
    if (!currentUserAddress) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/comment-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          walletAddress: currentUserAddress,
          voteType
        })
      });

      if (response.ok) {
        // Optimistically update the comment in the local state
        const updateCommentVotes = (comments: CommentData[]): CommentData[] => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              const updatedComment = { ...comment };
              if (comment.userVote === voteType) {
                // Removing vote
                if (voteType === 'upvote') {
                  updatedComment.upvotes = Math.max(0, comment.upvotes - 1);
                } else {
                  updatedComment.downvotes = Math.max(0, comment.downvotes - 1);
                }
                updatedComment.userVote = null;
              } else if (comment.userVote && comment.userVote !== voteType) {
                // Changing vote
                if (voteType === 'upvote') {
                  updatedComment.upvotes = comment.upvotes + 1;
                  updatedComment.downvotes = Math.max(0, comment.downvotes - 1);
                } else {
                  updatedComment.downvotes = comment.downvotes + 1;
                  updatedComment.upvotes = Math.max(0, comment.upvotes - 1);
                }
                updatedComment.userVote = voteType;
              } else {
                // Adding new vote
                if (voteType === 'upvote') {
                  updatedComment.upvotes = comment.upvotes + 1;
                } else {
                  updatedComment.downvotes = comment.downvotes + 1;
                }
                updatedComment.userVote = voteType;
              }
              return updatedComment;
            }
            return {
              ...comment,
              replies: updateCommentVotes(comment.replies)
            };
          });
        };

        setComments(updateCommentVotes);
      }
    } catch (error) {
      console.error('Failed to vote on comment:', error);
      throw error;
    }
  };

  const getDomain = (url: string) => {
    try {
      const { hostname } = new URL(url);
      return hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const isPdfUrl = (url: string): boolean => {
    return url.toLowerCase().includes('/uploads/evidence/') || url.toLowerCase().endsWith('.pdf');
  };

  if (!isOpen || !evidence) return null;

  return (
    <div className="fixed inset-0 bg-[#f8f9fa] flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow border border-gray-200 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {evidence.title}
            </h2>
            {evidence.url && (
              <p className="text-sm text-gray-500 mt-1">
                {isPdfUrl(evidence.url) ? 'pdf' : getDomain(evidence.url)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] bg-white">
          {/* Evidence description */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-800">{evidence.description}</p>
          </div>

          {/* New comment form */}
          {currentUserAddress && (
            <form onSubmit={handleSubmitComment} className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none bg-white text-gray-900"
                rows={3}
                disabled={isSubmitting}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          )}

          {/* Comments section */}
          <div className="bg-white">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Comments ({comments.length})
            </h3>
            
            {isLoading ? (
              <div className="text-center py-8 bg-white">
                <div className="text-gray-500">Loading comments...</div>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 bg-white">
                <div className="text-gray-500">No comments yet. Be the first to comment!</div>
              </div>
            ) : (
              <div className="space-y-4 bg-white">
                {comments.map((comment) => (
                  <Comment
                    key={comment.id}
                    comment={comment}
                    evidenceId={evidence.id}
                    currentUserAddress={currentUserAddress}
                    onReply={handleReply}
                    onVote={handleVote}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentsModal; 