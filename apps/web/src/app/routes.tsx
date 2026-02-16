import { createBrowserRouter } from 'react-router';
import { RootLayout } from './pages/RootLayout';
import { TextbookPage } from './pages/TextbookPage';
import { ResearchPage } from './pages/ResearchPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        // Practice page is rendered directly in RootLayout to preserve state
        index: true,
        element: null,
      },
      {
        path: 'textbook',
        Component: TextbookPage,
      },
      {
        path: 'research',
        Component: ResearchPage,
      },
    ],
  },
]);
