import React, { useState } from 'react';

interface CommentProps {
  comment: {
    id: number;
    content: string;
    walletAddress: string;
    createdAt: string;
    upvotes: number;
    downvotes: number;
    userVote?: string | null;
    replies: any[];
  };
  evidenceId: number;
  currentUserAddress?: string;
  onReply: (parentId: number, content: string) => void;
  onVote: (commentId: number, voteType: 'upvote' | 'downvote') => void;
  depth?: number;
}

const Comment: React.FC<CommentProps> = ({ 
  comment, 
  evidenceId, 
  currentUserAddress, 
  onReply, 
  onVote,
  depth = 0 
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !currentUserAddress) return;

    setIsSubmitting(true);
    try {
      await onReply(comment.id, replyContent);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Failed to submit reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!currentUserAddress || isVoting) return;
    
    setIsVoting(true);
    try {
      await onVote(comment.id, voteType);
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const netVotes = comment.upvotes - comment.downvotes;

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''} bg-white`}>
      <div className="mb-3 bg-white">
        <div className="flex items-start gap-3 bg-white">
          {/* Voting buttons */}
          <div className="flex flex-col items-center gap-1 bg-white">
            <button
              onClick={() => handleVote('upvote')}
              disabled={isVoting}
              className={`p-1 rounded hover:bg-gray-100 transition-colors bg-white ${
                comment.userVote === 'upvote' ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            <span className="text-sm font-medium text-gray-500">
              {netVotes}
            </span>
            
            <button
              onClick={() => handleVote('downvote')}
              disabled={isVoting}
              className={`p-1 rounded hover:bg-gray-100 transition-colors bg-white ${
                comment.userVote === 'downvote' ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Comment content */}
          <div className="flex-1 bg-white">
            <div className="flex items-center mb-2 bg-white">
              <span className="text-sm font-medium text-gray-700">
                {shortenAddress(comment.walletAddress)}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                {formatDate(comment.createdAt)}
              </span>
            </div>
            <div className="text-sm text-gray-800 mb-2 bg-white">
              {comment.content}
            </div>
            {currentUserAddress && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium bg-white"
              >
                Reply
              </button>
            )}
          </div>
        </div>
      </div>

      {showReplyForm && (
        <form onSubmit={handleSubmitReply} className="mb-3 ml-7 bg-white">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-none bg-white text-gray-900"
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex gap-2 mt-2 bg-white">
            <button
              type="submit"
              disabled={!replyContent.trim() || isSubmitting}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post Reply'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReplyForm(false);
                setReplyContent('');
              }}
              className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2 bg-white">
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              evidenceId={evidenceId}
              currentUserAddress={currentUserAddress}
              onReply={onReply}
              onVote={onVote}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Comment; 