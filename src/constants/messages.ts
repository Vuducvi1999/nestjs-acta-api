export const messages = {
  referrerNotFound: 'Referrer not found or not verified',
  registerSuccess: 'Register successful',
  passwordResetEmailSent: 'Password reset email sent',
  emailAlreadyExists: 'Email already exists',
  phoneNumberAlreadyExists: 'Phone number already exists',
  userNotFound: 'User not found',
  userNotFoundOrNotVerified: 'User not found or not verified',
  userNotVerified: 'User not verified',
  userAlreadyVerified: 'User already verified',
  userAlreadyExists: 'User already exists',
  userNotExists: 'User not exists',
  invalidRefreshToken: 'Invalid refresh token',
  refreshTokenExpired: 'Refresh token expired',
  duplicateDocumentWithSameNameAndCategory:
    'Document with this title already exists in the specified category',
  invalidCredentials: 'Invalid credentials',
  invalidResetToken: 'Invalid or expired reset token',
  invalidToken: 'Invalid token',
  emailSendingFailed: 'Email sending failed',
  passwordResetSuccess: 'Password reset successful',
  passwordResetEmailAlreadySent:
    'Password reset email already sent, please check your email',
  userNotPendingApproval: 'User is not pending approval',
  userNotReferrer: 'User is not referrer',
  invalidRequestAction: 'Invalid request action',
  userNotActive: 'User is not active',
  invalidCurrentPassword: 'Your current password is incorrect.',
  invalidOtp: 'Invalid or expired OTP.',
  passwordChangeSuccess: 'Password changed successfully',
  userNotVerifiedEmailSentAgain:
    'User not verified, email sent again, please check your email',
  userWithSamePhoneNumberAlreadyExists:
    'User with same phone number already exists',
  usernameAndPasswordRequired: 'Username and password are required',
  userActionRequestedSuccessfully: 'User action requested successfully',
  userActionRequestedFailed: 'User action requested failed',
  invalidVerificationToken: 'Invalid verification token',
  expiredVerficationTokenAndResend:
    'Expired verification token, please verify again',
  emailVerifiedSuccessfully: 'Email verified successfully',
  kycNotFound: 'KYC not found',
  systemError: 'System error',
};

// User-friendly Vietnamese error messages for login
export const loginErrorMessages = {
  [messages.usernameAndPasswordRequired]:
    'Vui lòng nhập tên đăng nhập và mật khẩu',
  [messages.invalidCredentials]: 'Thông tin đăng nhập không chính xác',
  [messages.userNotReferrer]: 'Bạn không phải là người giới thiệu',
  [messages.userNotVerifiedEmailSentAgain]:
    'Tài khoản chưa được xác thực, email đã được gửi lại, vui lòng kiểm tra email',
  [messages.userNotActive]: 'Tài khoản chưa được kích hoạt',
  [messages.userNotFound]: 'Tài khoản không tồn tại',
  [messages.emailAlreadyExists]: 'Email đã tồn tại',
  // Network/system errors
  networkError: 'Lỗi kết nối mạng. Vui lòng thử lại sau',
  systemError: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau',
};
