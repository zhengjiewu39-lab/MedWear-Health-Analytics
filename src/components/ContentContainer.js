import React from 'react';
import { Box } from '@mui/material';

/** Consistent page width and vertical rhythm for all main views. */
export default function ContentContainer({ children, maxWidth = 1280 }) {
  return (
    <Box
      sx={{
        maxWidth,
        mx: 'auto',
        px: { xs: 0, sm: 0.5 },
        pb: 4,
        '& > *:first-of-type': { mt: 0 },
      }}
    >
      {children}
    </Box>
  );
}
