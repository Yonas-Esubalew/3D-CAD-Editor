import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import ThreeJsCadEditor from "../pages/2DEditor";
import ThreeDEditor from "../pages/3DEditor";
import CADEditor from "../pages/2DEditor";
import SketchApp from "../pages/2DEditor";
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "2d-editor",
        element: <SketchApp />,
      },
      {
        path: "/",
        element: <ThreeDEditor/>
      }
    ],
  },
]);

export default router;
