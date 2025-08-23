import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import ThreeJsCadEditor from "../pages/3DPage";
import ThreeDEditor from "../pages/3dcode";
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "page",
        element: <ThreeJsCadEditor />,
      },
      {
        path: "page1",
        element: <ThreeDEditor/>
      }
    ],
  },
]);

export default router;
