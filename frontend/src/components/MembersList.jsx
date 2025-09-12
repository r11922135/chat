import { useState, useEffect } from 'react'
import chatService from '../services/chatService'
import InviteUsers from './InviteUsers'
import './MembersList.css'

const MembersList = ({ room, onClose, currentUser }) => {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInviteUsers, setShowInviteUsers] = useState(false)

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true)
        const membersData = await chatService.getRoomMembers(room.id)
        setMembers(membersData)
      } catch (err) {
        console.error('Error fetching members:', err)
        setError('Failed to load members')
      } finally {
        setLoading(false)
      }
    }

    if (room?.id) {
      fetchMembers()
    }
  }, [room?.id])

  // 暫時隱藏退出群組功能
  // const handleLeaveRoom = async () => {
  //   if (window.confirm('Are you sure you want to leave this room?')) {
  //     try {
  //       await chatService.leaveRoom(room.id)
  //       onLeaveRoom(room.id)
  //       onClose()
  //     } catch (err) {
  //       console.error('Error leaving room:', err)
  //       setError('Failed to leave room')
  //     }
  //   }
  // }

  const formatJoinDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleInviteSuccess = () => {
    // Refresh members list after successful invite
    const fetchMembers = async () => {
      try {
        const membersData = await chatService.getRoomMembers(room.id)
        setMembers(membersData)
      } catch (err) {
        console.error('Error refreshing members:', err)
      }
    }
    fetchMembers()
    setShowInviteUsers(false)
  }

  return (
    <div className="members-modal-overlay" onClick={onClose}>
      <div className="members-modal" onClick={(e) => e.stopPropagation()}>
        <div className="members-header">
          <h3>Room Members</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="members-content">
          {loading ? (
            <div className="loading">Loading members...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <div className="members-list">
              <div className="members-count-header">
                <div className="members-count">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </div>
                {room?.isGroup && (
                  <button 
                    className="invite-btn" 
                    onClick={() => setShowInviteUsers(true)}
                    title="Invite users to this room"
                  >
                    +
                  </button>
                )}
              </div>
              
              {members.map((member) => (
                <div key={member.id} className="member-item">
                  <div className="member-info">
                    <div className="member-avatar">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="member-details">
                      <div className="member-name">
                        {member.username}
                        {member.username === currentUser && (
                          <span className="you-label">(You)</span>
                        )}
                      </div>
                      <div className="member-joined">
                        Joined {formatJoinDate(member.joinedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 暫時隱藏退出群組功能 */}
        {/* {room?.isGroup && (
          <div className="members-actions">
            <button 
              className="leave-room-btn"
              onClick={handleLeaveRoom}
              disabled={loading}
            >
              Leave Room
            </button>
          </div>
        )} */}
      </div>
      
      {showInviteUsers && (
        <InviteUsers
          room={room}
          onClose={() => setShowInviteUsers(false)}
          onInviteSuccess={handleInviteSuccess}
        />
      )}
    </div>
  )
}

export default MembersList